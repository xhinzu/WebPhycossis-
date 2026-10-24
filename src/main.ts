import './style.css';
import type { EffectSettings, Preset, QualityLevel } from './types';
import { DEFAULT_SETTINGS, loadCustomSettings } from './presets';
import { CameraManager } from './camera';
import { ShaderPipeline } from './shaderPipeline';
import { AudioManager } from './audio';
import { RecorderManager } from './recorder';
import { HudManager } from './hud';
import { UiManager } from './ui';
import { SegmentationManager } from './segmentation';

class WebPhycossisApp {
  private settings: EffectSettings;
  private camera: CameraManager;
  private pipeline!: ShaderPipeline;
  private audio: AudioManager;
  private recorder!: RecorderManager;
  private hud!: HudManager;
  private ui!: UiManager;
  private segmentation: SegmentationManager;

  private isRunning: boolean = false;
  private dynamicBurst: number = 0.0;
  private lastFrameTimestamp: number = 0;

  constructor() {
    const saved = loadCustomSettings();
    this.settings = { ...DEFAULT_SETTINGS, ...saved };

    this.camera = new CameraManager();
    this.audio = new AudioManager();
    this.segmentation = new SegmentationManager();
  }

  public async init(): Promise<void> {
    const appEl = document.querySelector<HTMLDivElement>('#app');
    if (!appEl) return;

    // 1. Initialize UI
    this.ui = new UiManager(appEl, this.settings, {
      onSettingsChange: (newSettings) => this.handleSettingsChange(newSettings),
      onPresetSelect: (preset) => this.handlePresetSelect(preset),
      onRecordToggle: () => this.handleRecordToggle(),
      onSnapshot: () => this.handleSnapshot(),
      onSandevistanBurst: () => this.handleSandevistanBurst(),
      onMicToggle: () => this.handleMicToggle(),
      onCameraFlip: () => this.handleCameraFlip(),
      onMirrorToggle: () => this.handleMirrorToggle(),
      onHudToggle: () => this.handleHudToggle(),
      onQualityChange: (q) => this.handleQualityChange(q),
    });

    // 2. Initialize HUD
    this.hud = new HudManager(this.ui.hudContainer);
    this.hud.setVisible(this.settings.hudVisible);

    // 3. Initialize WebGL Shader Pipeline
    try {
      this.pipeline = new ShaderPipeline(this.ui.canvas);
      this.pipeline.setQuality(this.settings.quality);
    } catch (glErr) {
      console.error('WebGL initialization error:', glErr);
      this.ui.showToast('WebGL error: check browser acceleration');
      return;
    }

    // 4. Initialize Recorder
    this.recorder = new RecorderManager(this.ui.canvas);
    this.recorder.onTimeUpdate = (formattedTime) => {
      this.hud.update({
        fps: this.pipeline.getFps(),
        quality: this.settings.quality,
        renderWidth: this.pipeline.getRenderResolution().width,
        renderHeight: this.pipeline.getRenderResolution().height,
        intensity: Math.min(1.0, this.settings.masterIntensity + this.dynamicBurst),
        audioLevel: this.audio.getAudioLevel(),
        isRecording: true,
        recordingTime: formattedTime,
        hasSegmentation: this.settings.useSegmentation && this.segmentation.isAvailable(),
      });
    };
    this.recorder.onRecordingComplete = (blob, mimeType, url) => {
      this.ui.setRecordingUi(false);
      this.ui.showVideoModal(blob, mimeType, url);
    };

    // 5. Connect Segmentation Callback
    this.segmentation.onMaskAvailable = (data, w, h) => {
      this.pipeline.updateMask(data, w, h);
    };

    // 6. Connect Audio Scream Event
    this.audio.onScreamDetected = () => {
      if (this.settings.autoTrigger) {
        this.handleSandevistanBurst();
        this.ui.showToast('NEURAL AUDIO SPIKE DETECTED!');
      }
    };

    // 7. Start Camera
    const cameraSuccess = await this.camera.startCamera(this.settings.facingMode);
    if (!cameraSuccess) {
      const err = this.camera.state.errorMessage || 'Camera access error';
      this.ui.showToast(err);
    } else {
      const vid = this.camera.getVideoElement();
      this.pipeline.setVideoDimensions(vid.videoWidth || 1280, vid.videoHeight || 720);
    }

    // 8. Start Segmentation if enabled
    if (this.settings.useSegmentation) {
      this.segmentation.init();
    }

    // 9. Start Main Render Loop
    this.isRunning = true;
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  private renderLoop(timestamp: number): void {
    if (!this.isRunning) return;

    const delta = this.lastFrameTimestamp > 0 ? (timestamp - this.lastFrameTimestamp) / 1000 : 0.016;
    this.lastFrameTimestamp = timestamp;

    // Decay dynamic burst
    if (this.dynamicBurst > 0) {
      this.dynamicBurst = Math.max(0, this.dynamicBurst - delta * 1.8);
    }

    const videoEl = this.camera.getVideoElement();
    const hasFrame = videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    let audioLevel = 0;
    if (this.audio.isMicActive()) {
      audioLevel = this.audio.getAudioLevel();

      // Audio reactive glitch spike
      if (this.settings.autoTrigger && audioLevel > 0.1) {
        this.dynamicBurst = Math.max(this.dynamicBurst, audioLevel * this.settings.audioSensitivity * 0.45);
      }
    }

    // Update ambient drone/hum based on neural intensity
    const totalIntensity = Math.min(1.0, this.settings.masterIntensity + this.dynamicBurst);
    this.audio.updateHum(totalIntensity);

    if (hasFrame) {
      // Process segmentation asynchronously
      if (this.settings.useSegmentation) {
        if (!this.segmentation.isAvailable()) {
          this.segmentation.init();
        } else {
          this.segmentation.processVideoFrame(videoEl, timestamp);
        }
      }

      // WebGL Render Pass
      this.pipeline.render(videoEl, this.settings, timestamp, this.dynamicBurst);
    }

    // Update HUD Stats
    const res = this.pipeline.getRenderResolution();
    this.hud.update({
      fps: this.pipeline.getFps(),
      quality: this.settings.quality,
      renderWidth: res.width,
      renderHeight: res.height,
      intensity: totalIntensity,
      audioLevel,
      isRecording: this.recorder.state.isRecording,
      recordingTime: `${Math.floor(this.recorder.state.durationMs / 1000)}s`,
      hasSegmentation: this.settings.useSegmentation && this.segmentation.isAvailable(),
      mode: this.settings.effectMode === 'motion_trails' ? 'MODE: MOTION TRAILS' : 'MODE: OVERLAY',
    });

    requestAnimationFrame((t) => this.renderLoop(t));
  }

  private handleSettingsChange(newSettings: EffectSettings): void {
    this.settings = { ...newSettings };
    if (this.settings.useSegmentation && !this.segmentation.isAvailable()) {
      this.segmentation.init();
    }
  }

  private handlePresetSelect(preset: Preset): void {
    this.settings = { ...this.settings, ...preset.settings };
    this.pipeline.setQuality(this.settings.quality);
    if (preset.id === 'cyberpsychosis') {
      this.audio.playFlatlineAlarm();
    } else {
      this.audio.playClick();
    }
  }

  private handleSandevistanBurst(): void {
    this.audio.playSandevistan();
    this.pipeline.triggerShockwave();
    this.dynamicBurst = 0.55;
    this.ui.showToast('SANDEVISTAN ENGAGED // ACCELERATED');
  }

  private handleRecordToggle(): void {
    this.audio.playClick();
    if (!this.recorder.state.isRecording) {
      const mixedAudio = this.audio.getMixedAudioStream();
      const started = this.recorder.startRecording(mixedAudio);
      if (started) {
        this.ui.setRecordingUi(true);
        this.ui.showToast('RECORDING STARTED (MAX 60s)');
      } else {
        this.ui.showToast('Could not start recording on this device');
      }
    } else {
      this.recorder.stopRecording();
      this.ui.setRecordingUi(false);
      this.ui.showToast('RECORDING STOPPED // COMPILING CLIP');
    }
  }

  private handleSnapshot(): void {
    this.audio.playClick();
    const { dataUrl, blob } = this.recorder.takeSnapshot();
    this.ui.showSnapshotModal(dataUrl, blob);
    this.ui.showToast('SNAPSHOT CAPTURED');
  }

  private async handleMicToggle(): Promise<void> {
    const active = await this.audio.toggleMic();
    this.settings.micEnabled = active;
    this.ui.setMicUi(active);
    this.ui.showToast(active ? 'MIC CONNECTED // AUDIO REACTIVE' : 'MIC DISCONNECTED');
  }

  private async handleCameraFlip(): Promise<void> {
    this.audio.playClick();
    this.ui.showToast('SWITCHING OPTIC SENSOR...');
    await this.camera.flipCamera();
    this.settings.facingMode = this.camera.state.facingMode;
    this.settings.mirror = this.camera.state.mirror;
    this.ui.setMirrorUi(this.settings.mirror);
  }

  private handleMirrorToggle(): void {
    this.audio.playClick();
    const isMirrored = this.camera.toggleMirror();
    this.settings.mirror = isMirrored;
    this.ui.setMirrorUi(isMirrored);
    this.ui.showToast(isMirrored ? 'MIRROR: ON' : 'MIRROR: OFF');
  }

  private handleHudToggle(): void {
    this.audio.playClick();
    const visible = this.hud.toggle();
    this.settings.hudVisible = visible;
    this.ui.setHudUi(visible);
    this.ui.showToast(visible ? 'HUD: ENGAGED' : 'HUD: DISABLED');
  }

  private handleQualityChange(q: QualityLevel): void {
    this.settings.quality = q;
    this.pipeline.setQuality(q);
    this.segmentation.setQuality(q);
    this.ui.showToast(`QUALITY: ${q.toUpperCase()}`);
  }
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
  const app = new WebPhycossisApp();
  app.init().catch((err) => {
    console.error('Fatal app initialization error:', err);
  });
});
