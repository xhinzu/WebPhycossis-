export type QualityLevel = 'auto' | 'high' | 'med' | 'low';
export type EffectMode = 'motion_trails' | 'overlay';

export interface EffectSettings {
  // Mode: 'motion_trails' (clean video + ghost trails on motion) | 'overlay' (full-frame glitch)
  effectMode: EffectMode;

  // Master
  masterIntensity: number; // 0.0 to 1.0

  // Ghost Trails
  trailPersistence: number; // 0.70 to 0.98
  trailDecay: number; // 0.01 to 0.30
  trailLag: number; // 0.0 to 1.0
  trailSpread: number; // 0.0 to 1.0 (spacing of discrete echoes)
  trailCount: number; // 1 to 6 (number of discrete echoes)
  trailBrightness: number; // 0.5 to 2.5
  trailColor: [number, number, number]; // [r, g, b] 0-1

  // Glitch layers
  rgbSplit: number; // 0.0 to 0.06
  sliceJitter: number; // 0.0 to 1.0
  scanlines: number; // 0.0 to 1.0
  noise: number; // 0.0 to 1.0
  pixelSort: number; // 0.0 to 1.0

  // Grading & Look
  contrast: number; // 1.0 to 2.2
  greenGrade: number; // 0.0 to 1.0
  desatBg: number; // 0.0 to 1.0 (when segmentation active)

  // Features
  useSegmentation: boolean;
  autoTrigger: boolean;
  motionSensitivity: number; // 0.0 to 1.0
  audioSensitivity: number; // 0.0 to 1.0
  screamThreshold: number; // 0.0 to 1.0

  // Sound & Audio
  sfxVolume: number; // 0.0 to 1.0
  sfxMute: boolean;
  micEnabled: boolean;

  // Options & Overlays
  watermark: boolean;
  quality: QualityLevel;
  mirror: boolean;
  flipY: boolean;
  facingMode: 'user' | 'environment';
  hudVisible: boolean;
}

export interface Preset {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  settings: Partial<EffectSettings>;
}

export interface CameraState {
  hasCamera: boolean;
  isStreaming: boolean;
  facingMode: 'user' | 'environment';
  mirror: boolean;
  videoWidth: number;
  videoHeight: number;
  errorMessage: string | null;
}

export interface RecordingState {
  isRecording: boolean;
  durationMs: number;
  blob: Blob | null;
  mimeType: string;
  url: string | null;
}
