import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

export class SegmentationManager {
  private segmenter: ImageSegmenter | null = null;
  private isInitializing: boolean = false;
  private isReady: boolean = false;
  private isProcessing: boolean = false;
  private lastProcessTime: number = 0;
  private frameIntervalMs: number = 50; // Run at ~20fps max for smooth background segmentation without hitching
  private hasWarnedFailure: boolean = false;

  public onMaskAvailable: ((data: Float32Array, width: number, height: number) => void) | null = null;

  constructor() {}

  public async init(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isInitializing) return false;
    this.isInitializing = true;

    try {
      // Self-hosted MediaPipe WASM files from /mediapipe/wasm
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');

      // Try GPU delegate first, fallback to CPU if GPU delegate is unavailable
      try {
        this.segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe/models/selfie_segmenter.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      } catch (gpuErr) {
        console.warn('MediaPipe GPU delegate failed, falling back to CPU delegate:', gpuErr);
        this.segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe/models/selfie_segmenter.tflite',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      }

      this.isReady = true;
      this.isInitializing = false;
      return true;
    } catch (err) {
      if (!this.hasWarnedFailure) {
        console.warn('Selfie segmenter initialization failed; falling back to full-frame mode:', err);
        this.hasWarnedFailure = true;
      }
      this.isInitializing = false;
      this.isReady = false;
      return false;
    }
  }

  public isAvailable(): boolean {
    return this.isReady;
  }

  public setQuality(quality: 'auto' | 'high' | 'med' | 'low'): void {
    if (quality === 'high') {
      this.frameIntervalMs = 40; // ~25 fps
    } else if (quality === 'med') {
      this.frameIntervalMs = 70; // ~14 fps (every 2nd frame)
    } else if (quality === 'low') {
      this.frameIntervalMs = 120; // ~8 fps (every 3rd-4th frame, reusing previous mask)
    } else {
      this.frameIntervalMs = 50; // auto ~20 fps
    }
  }

  public processVideoFrame(video: HTMLVideoElement, timestamp: number): void {
    if (!this.isReady || !this.segmenter || this.isProcessing) return;
    if (timestamp - this.lastProcessTime < this.frameIntervalMs) return;

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    this.isProcessing = true;
    this.lastProcessTime = timestamp;

    try {
      this.segmenter.segmentForVideo(video, timestamp, (result) => {
        try {
          if (result && result.confidenceMasks && result.confidenceMasks.length > 0) {
            const mask = result.confidenceMasks[0];
            const width = mask.width;
            const height = mask.height;
            const floatData = mask.getAsFloat32Array();

            if (this.onMaskAvailable) {
              this.onMaskAvailable(floatData, width, height);
            }
          }
        } finally {
          this.isProcessing = false;
        }
      });
    } catch (err) {
      console.warn('Segmentation frame error:', err);
      this.isProcessing = false;
    }
  }

  public close(): void {
    if (this.segmenter) {
      try {
        this.segmenter.close();
      } catch {}
      this.segmenter = null;
    }
    this.isReady = false;
  }
}
