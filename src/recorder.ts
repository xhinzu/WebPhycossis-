import type { RecordingState } from './types';

export class RecorderManager {
  private canvas: HTMLCanvasElement;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private timerInterval: number | null = null;
  private maxDurationMs: number = 60000; // 60s max clip length

  public state: RecordingState = {
    isRecording: false,
    durationMs: 0,
    blob: null,
    mimeType: '',
    url: null,
  };

  public onTimeUpdate: ((formattedTime: string, percent: number) => void) | null = null;
  public onRecordingComplete: ((blob: Blob, mimeType: string, url: string) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public getBestMimeType(): string {
    const types = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          return t;
        }
      }
    }
    return 'video/webm';
  }

  public startRecording(mixedAudioStream?: MediaStream | null): boolean {
    if (this.state.isRecording) return false;

    try {
      // 1. Get video stream from canvas
      const canvasStream = this.canvas.captureStream(30);

      // 2. Mix in audio tracks if provided
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

      if (mixedAudioStream) {
        mixedAudioStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
      }

      // 3. Determine MIME type
      const mimeType = this.getBestMimeType();
      this.state.mimeType = mimeType;

      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }
      // Bitrate options
      options.videoBitsPerSecond = 3500000; // 3.5 Mbps for crisp cyberpunk visuals

      this.mediaRecorder = new MediaRecorder(combinedStream, options);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const finalBlob = new Blob(this.recordedChunks, {
          type: this.state.mimeType || 'video/mp4',
        });
        const url = URL.createObjectURL(finalBlob);
        this.state.blob = finalBlob;
        this.state.url = url;
        this.state.isRecording = false;

        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }

        if (this.onRecordingComplete) {
          this.onRecordingComplete(finalBlob, this.state.mimeType, url);
        }
      };

      this.mediaRecorder.start(250); // collect chunks every 250ms
      this.startTime = performance.now();
      this.state.isRecording = true;
      this.state.durationMs = 0;

      // Start timer
      this.timerInterval = window.setInterval(() => {
        const elapsed = performance.now() - this.startTime;
        this.state.durationMs = elapsed;

        const seconds = Math.floor(elapsed / 1000);
        const mins = Math.floor(seconds / 60);
        const remSecs = seconds % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')} / 01:00`;
        const percent = Math.min(100, (elapsed / this.maxDurationMs) * 100);

        if (this.onTimeUpdate) {
          this.onTimeUpdate(formatted, percent);
        }

        // Auto-stop at 60 seconds
        if (elapsed >= this.maxDurationMs) {
          this.stopRecording();
        }
      }, 200);

      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      this.state.isRecording = false;
      return false;
    }
  }

  public stopRecording(): void {
    if (this.mediaRecorder && this.state.isRecording) {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
      }
    }
  }

  public takeSnapshot(): { dataUrl: string; blob: Promise<Blob | null> } {
    const dataUrl = this.canvas.toDataURL('image/png');
    const blobPromise = new Promise<Blob | null>((resolve) => {
      this.canvas.toBlob((b) => resolve(b), 'image/png');
    });
    return { dataUrl, blob: blobPromise };
  }

  public static async shareOrDownload(
    fileBlob: Blob,
    filename: string,
    title = 'WebPhycossis Glitch',
    text = 'Neural glitch effect recorded with WebPhycossis // Sandevistan filter'
  ): Promise<'shared' | 'downloaded'> {
    const file = new File([fileBlob], filename, { type: fileBlob.type });

    // Check if Web Share API with files is supported
    if (
      navigator.canShare &&
      navigator.canShare({ files: [file] }) &&
      navigator.share
    ) {
      try {
        await navigator.share({
          files: [file],
          title,
          text,
        });
        return 'shared';
      } catch (err) {
        // If user cancelled, don't download unnecessarily unless it was an actual error
        if ((err as Error).name !== 'AbortError') {
          console.warn('Web Share failed, falling back to download:', err);
          RecorderManager.downloadBlob(fileBlob, filename);
          return 'downloaded';
        }
        return 'shared';
      }
    } else {
      // Fallback to direct download
      RecorderManager.downloadBlob(fileBlob, filename);
      return 'downloaded';
    }
  }

  public static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
