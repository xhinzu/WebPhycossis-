import type { CameraState } from './types';

export class CameraManager {
  private video: HTMLVideoElement;
  private currentStream: MediaStream | null = null;
  public state: CameraState = {
    hasCamera: false,
    isStreaming: false,
    facingMode: 'user',
    mirror: true,
    videoWidth: 1280,
    videoHeight: 720,
    errorMessage: null,
  };

  private onStateChangeCb: ((state: CameraState) => void) | null = null;

  constructor(videoElement?: HTMLVideoElement) {
    if (videoElement) {
      this.video = videoElement;
    } else {
      this.video = document.createElement('video');
    }
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.setAttribute('playsinline', 'true');
    this.video.setAttribute('webkit-playsinline', 'true');
  }

  public getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  public onStateChange(cb: (state: CameraState) => void): void {
    this.onStateChangeCb = cb;
  }

  private notify(): void {
    if (this.onStateChangeCb) {
      this.onStateChangeCb({ ...this.state });
    }
  }

  public async startCamera(facingMode: 'user' | 'environment' = 'user'): Promise<boolean> {
    this.state.facingMode = facingMode;
    // By default mirror user facing camera, don't mirror environment camera
    this.state.mirror = facingMode === 'user';
    this.state.errorMessage = null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.state.errorMessage = 'Camera API not supported on this browser or secure context (HTTPS required).';
      this.state.hasCamera = false;
      this.notify();
      return false;
    }

    this.stopCamera();

    const constraintsList: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60, min: 24 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let stream: MediaStream | null = null;
    let lastError: unknown = null;

    for (const constraints of constraintsList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!stream) {
      let msg = 'Failed to access camera.';
      if (lastError instanceof DOMException) {
        if (lastError.name === 'NotAllowedError' || lastError.name === 'PermissionDeniedError') {
          msg = 'Camera permission denied. Please allow camera access in your browser settings to use WebPhycossis.';
        } else if (lastError.name === 'NotFoundError' || lastError.name === 'DevicesNotFoundError') {
          msg = 'No camera device found on this system.';
        } else if (lastError.name === 'NotReadableError' || lastError.name === 'TrackStartError') {
          msg = 'Camera is currently in use by another application or tab.';
        } else {
          msg = `Camera error: ${lastError.message || lastError.name}`;
        }
      }
      this.state.errorMessage = msg;
      this.state.hasCamera = false;
      this.state.isStreaming = false;
      this.notify();
      return false;
    }

    this.currentStream = stream;
    this.video.srcObject = stream;

    return new Promise((resolve) => {
      this.video.onloadedmetadata = async () => {
        try {
          await this.video.play();
          this.state.hasCamera = true;
          this.state.isStreaming = true;
          this.state.videoWidth = this.video.videoWidth || 1280;
          this.state.videoHeight = this.video.videoHeight || 720;
          this.state.errorMessage = null;
          this.notify();
          resolve(true);
        } catch (playErr) {
          console.warn('Video play interrupted:', playErr);
          this.state.isStreaming = true;
          this.notify();
          resolve(true);
        }
      };

      this.video.onerror = (e) => {
        console.error('Video element error:', e);
        this.state.errorMessage = 'Failed to render video stream.';
        this.notify();
        resolve(false);
      };
    });
  }

  public async flipCamera(): Promise<void> {
    const nextMode = this.state.facingMode === 'user' ? 'environment' : 'user';
    await this.startCamera(nextMode);
  }

  public toggleMirror(): boolean {
    this.state.mirror = !this.state.mirror;
    this.notify();
    return this.state.mirror;
  }

  public setMirror(mirror: boolean): void {
    this.state.mirror = mirror;
    this.notify();
  }

  public stopCamera(): void {
    if (this.currentStream) {
      for (const track of this.currentStream.getTracks()) {
        track.stop();
      }
      this.currentStream = null;
    }
    if (this.video.srcObject) {
      this.video.srcObject = null;
    }
    this.state.isStreaming = false;
    this.notify();
  }
}
