import type { EffectSettings, Preset } from './types';

export const DEFAULT_SETTINGS: EffectSettings = {
  masterIntensity: 0.65,
  trailPersistence: 0.92,
  trailDecay: 0.08,
  trailLag: 0.5,
  trailColor: [0.0, 1.0, 0.45], // Neon Edgerunners green
  rgbSplit: 0.02,
  sliceJitter: 0.4,
  scanlines: 0.35,
  noise: 0.25,
  pixelSort: 0.3,
  contrast: 1.35,
  greenGrade: 0.8,
  desatBg: 0.75,
  useSegmentation: false, // Default off for instant 60fps start, toggleable
  autoTrigger: true,
  motionSensitivity: 0.6,
  audioSensitivity: 0.7,
  screamThreshold: 0.65,
  sfxVolume: 0.75,
  sfxMute: false,
  micEnabled: false,
  watermark: true,
  quality: 'auto',
  mirror: true,
  flipY: true,
  facingMode: 'user',
  hudVisible: true,
};

export const PRESETS: Record<string, Preset> = {
  early_david: {
    id: 'early_david',
    name: 'Early David',
    subtitle: 'MK-1 / Sub-Clinical',
    description: 'Subtle neural drift. Mild green ghosting and slight chromatic aberration.',
    settings: {
      masterIntensity: 0.35,
      trailPersistence: 0.84,
      trailDecay: 0.16,
      trailLag: 0.3,
      rgbSplit: 0.008,
      sliceJitter: 0.15,
      scanlines: 0.2,
      noise: 0.15,
      pixelSort: 0.1,
      contrast: 1.15,
      greenGrade: 0.5,
      desatBg: 0.4,
      motionSensitivity: 0.4,
      audioSensitivity: 0.5,
    },
  },
  sandevistan: {
    id: 'sandevistan',
    name: 'Sandevistan',
    subtitle: 'Military Sandevistan Active',
    description: 'Iconic anime moment: intense neon-green ghost echoes lagging behind movement, sharp RGB split, desaturated background.',
    settings: {
      masterIntensity: 0.7,
      trailPersistence: 0.93,
      trailDecay: 0.07,
      trailLag: 0.6,
      rgbSplit: 0.024,
      sliceJitter: 0.45,
      scanlines: 0.35,
      noise: 0.25,
      pixelSort: 0.35,
      contrast: 1.4,
      greenGrade: 0.85,
      desatBg: 0.8,
      motionSensitivity: 0.65,
      audioSensitivity: 0.75,
    },
  },
  cyberpsychosis: {
    id: 'cyberpsychosis',
    name: 'Full Cyberpsychosis',
    subtitle: 'Flatline Imminent // Neural Purge',
    description: 'Total cyberware overload. Violent ghost trail feedback, heavy horizontal slice tears, maximum chromatic aberration, flatline alarm.',
    settings: {
      masterIntensity: 1.0,
      trailPersistence: 0.97,
      trailDecay: 0.03,
      trailLag: 0.9,
      rgbSplit: 0.05,
      sliceJitter: 0.9,
      scanlines: 0.6,
      noise: 0.55,
      pixelSort: 0.75,
      contrast: 1.8,
      greenGrade: 1.0,
      desatBg: 1.0,
      motionSensitivity: 0.85,
      audioSensitivity: 0.9,
    },
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    subtitle: 'User Neural Implant Config',
    description: 'Custom fine-tuned parameters saved directly in your browser storage.',
    settings: {},
  },
};

const STORAGE_KEY = 'webphycossis_custom_settings';

export function loadCustomSettings(): Partial<EffectSettings> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to load custom settings from localStorage', err);
  }
  return null;
}

export function saveCustomSettings(settings: EffectSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save custom settings to localStorage', err);
  }
}
