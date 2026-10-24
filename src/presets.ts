import type { EffectSettings, Preset } from './types';

export const DEFAULT_SETTINGS: EffectSettings = {
  effectMode: 'motion_trails', // Default mode on startup
  masterIntensity: 0.7,
  trailPersistence: 0.93,
  trailDecay: 0.07,
  trailLag: 0.6,
  trailSpread: 0.65,
  trailCount: 4,
  trailBrightness: 1.5,
  trailColor: [0.0, 1.0, 0.45], // Neon Edgerunners green
  rgbSplit: 0.024,
  sliceJitter: 0.45,
  scanlines: 0.35,
  noise: 0.25,
  pixelSort: 0.35,
  contrast: 1.35,
  greenGrade: 0.8,
  desatBg: 0.75,
  bgDarken: 0.25, // 25% background darkening by default for Motion Trails
  edgeFeather: 0.06, // Clean feathered subject edge
  trailOpacity: 1.2,
  faceProtection: true, // Always protect face region
  useSegmentation: true, // ON by default for Motion Trails mode
  autoTrigger: true,
  motionSensitivity: 0.65,
  audioSensitivity: 0.75,
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
    description: 'Subtle neural drift. Mild green ghost echoes on motion.',
    settings: {
      masterIntensity: 0.4,
      trailPersistence: 0.86,
      trailDecay: 0.14,
      trailLag: 0.35,
      trailSpread: 0.4,
      trailCount: 3,
      trailBrightness: 1.15,
      rgbSplit: 0.01,
      sliceJitter: 0.15,
      scanlines: 0.2,
      noise: 0.15,
      pixelSort: 0.1,
      contrast: 1.15,
      greenGrade: 0.5,
      desatBg: 0.4,
      motionSensitivity: 0.5,
      audioSensitivity: 0.55,
    },
  },
  sandevistan: {
    id: 'sandevistan',
    name: 'Sandevistan',
    subtitle: 'Military Sandevistan Active',
    description: 'Iconic anime moment: intense neon-green ghost echoes lagging behind movement, clean subject when still.',
    settings: {
      masterIntensity: 0.75,
      trailPersistence: 0.94,
      trailDecay: 0.06,
      trailLag: 0.65,
      trailSpread: 0.7,
      trailCount: 5,
      trailBrightness: 1.6,
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
    description: 'Total cyberware overload. Violent persistent ghost trail echoes, heavy slice tears, chromatic aberration.',
    settings: {
      masterIntensity: 1.0,
      trailPersistence: 0.97,
      trailDecay: 0.03,
      trailLag: 0.9,
      trailSpread: 0.9,
      trailCount: 6,
      trailBrightness: 2.2,
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
const MODE_STORAGE_KEY = 'webphycossis_effect_mode';

export function loadSavedMode(): 'motion_trails' | 'overlay' {
  try {
    const mode = localStorage.getItem(MODE_STORAGE_KEY);
    if (mode === 'overlay' || mode === 'motion_trails') {
      return mode;
    }
  } catch {}
  return 'motion_trails'; // Default for first-time visitors
}

export function saveSavedMode(mode: 'motion_trails' | 'overlay'): void {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch (err) {
    console.warn('Failed to save effect mode', err);
  }
}

export function loadCustomSettings(): Partial<EffectSettings> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const mode = loadSavedMode();
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.effectMode = mode;
      return parsed;
    }
    return { effectMode: mode };
  } catch (err) {
    console.warn('Failed to load custom settings from localStorage', err);
  }
  return { effectMode: 'motion_trails' };
}

export function saveCustomSettings(settings: EffectSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    saveSavedMode(settings.effectMode);
  } catch (err) {
    console.warn('Failed to save custom settings to localStorage', err);
  }
}
