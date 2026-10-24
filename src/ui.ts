import type { EffectSettings, Preset, QualityLevel } from './types';
import { PRESETS, DEFAULT_SETTINGS, saveCustomSettings } from './presets';
import { RecorderManager } from './recorder';

export interface UiCallbacks {
  onSettingsChange: (settings: EffectSettings) => void;
  onPresetSelect: (preset: Preset) => void;
  onRecordToggle: () => void;
  onSnapshot: () => void;
  onSandevistanBurst: () => void;
  onMicToggle: () => void;
  onCameraFlip: () => void;
  onMirrorToggle: () => void;
  onHudToggle: () => void;
  onQualityChange: (q: QualityLevel) => void;
}

export class UiManager {
  private appRoot: HTMLElement;
  private settings: EffectSettings;
  private callbacks: UiCallbacks;

  // Key DOM references
  public canvas!: HTMLCanvasElement;
  public video!: HTMLVideoElement;
  public hudContainer!: HTMLElement;

  private recordBtn!: HTMLElement;
  private micBtn!: HTMLElement;
  private mirrorBtn!: HTMLElement;
  private hudBtn!: HTMLElement;
  private fullscreenBtn!: HTMLElement;
  private masterSlider!: HTMLInputElement;
  private masterValBadge!: HTMLElement;
  private drawer!: HTMLElement;
  private toastEl!: HTMLElement;

  // Modals
  private snapshotModal!: HTMLElement;
  private snapshotImg!: HTMLImageElement;
  private videoModal!: HTMLElement;
  private previewVideo!: HTMLVideoElement;
  private privacyModal!: HTMLElement;

  private currentBlob: Blob | null = null;
  private currentFilename: string = '';

  constructor(appRoot: HTMLElement, initialSettings: EffectSettings, callbacks: UiCallbacks) {
    this.appRoot = appRoot;
    this.settings = { ...initialSettings };
    this.callbacks = callbacks;

    this.renderLayout();
    this.bindEvents();
    this.syncControls();
  }

  private renderLayout(): void {
    this.appRoot.innerHTML = `
      <!-- WebGL Canvas Container -->
      <div class="canvas-container">
        <canvas id="gl-canvas"></canvas>
      </div>

      <!-- Hidden Video Element for getUserMedia stream -->
      <video id="webcam-video" style="display:none;" playsinline webkit-playsinline muted autoplay></video>

      <!-- Client-side Privacy Badge -->
      <div id="btn-privacy-badge" class="client-side-badge" title="Click for privacy details">
        <span class="shield-icon">🔒</span>
        <span>100% ON-DEVICE & CLIENT-SIDE</span>
      </div>

      <!-- Top Action Bar -->
      <div class="top-action-bar">
        <button id="btn-toggle-hud" class="cyber-icon-btn active" title="Toggle Cyber HUD (H)">
          <span>HUD</span>
        </button>
        <button id="btn-toggle-fullscreen" class="cyber-icon-btn" title="Toggle Fullscreen">
          <span>⛶</span>
        </button>
      </div>

      <!-- Cyberpunk HUD Overlay -->
      <div id="hud-overlay"></div>

      <!-- Bottom Controls Bar -->
      <div class="bottom-controls-bar">
        <!-- Mode Switcher: Motion Trails (Default) vs Overlay -->
        <div class="mode-switcher-bar">
          <button class="mode-pill active" data-mode="motion_trails" title="Clean subject when still; neon ghost trails ONLY on movement">
            <span>⚡ MOTION TRAILS</span>
            <span class="mode-badge">DEFAULT</span>
          </button>
          <button class="mode-pill" data-mode="overlay" title="Full-frame green glitch and continuous cyberpsychosis overlay">
            <span>🔮 OVERLAY</span>
          </button>
        </div>

        <!-- Presets Row -->
        <div class="presets-strip">
          <button class="preset-pill" data-preset="early_david">EARLY DAVID</button>
          <button class="preset-pill active" data-preset="sandevistan">SANDEVISTAN</button>
          <button class="preset-pill" data-preset="cyberpsychosis">CYBERPSYCHOSIS</button>
          <button class="preset-pill" data-preset="custom">CUSTOM</button>
        </div>

        <!-- Master Glitch Intensity Slider -->
        <div class="master-slider-row">
          <span class="slider-label">NEURAL LOAD</span>
          <div class="cyber-range-wrapper">
            <input type="range" id="master-intensity-slider" class="cyber-slider" min="0" max="100" value="65" />
          </div>
          <span id="master-intensity-val" class="slider-value-badge">65%</span>
        </div>

        <!-- Primary Action Buttons -->
        <div class="action-buttons-row">
          <!-- Mic Toggle -->
          <button id="btn-mic" class="tool-btn" title="Audio Reactive Mic (M)">
            <span id="mic-icon">🎙️</span>
            <span>MIC</span>
          </button>

          <!-- Snapshot -->
          <button id="btn-snapshot" class="btn-action-circle" title="Take Snapshot (S)">
            <span>📷</span>
          </button>

          <!-- Big Record Button -->
          <button id="btn-record" class="btn-record" title="Record Video (R)">
            <div class="record-inner"></div>
          </button>

          <!-- Sandevistan Instant Burst -->
          <button id="btn-sandevistan-burst" class="btn-sandevistan" title="Activate Sandevistan Burst (Space)">
            <span>⚡</span>
            <span>SANDEVISTAN</span>
          </button>

          <!-- Camera Flip -->
          <button id="btn-flip-cam" class="tool-btn" title="Flip Camera Front/Back">
            <span>🔄</span>
            <span>FLIP</span>
          </button>

          <!-- Mirror Toggle -->
          <button id="btn-mirror" class="tool-btn active" title="Mirror Camera">
            <span>🪞</span>
            <span>MIRROR</span>
          </button>

          <!-- Advanced Settings Drawer Toggle -->
          <button id="btn-advanced" class="tool-btn" title="Advanced Shader Controls">
            <span>⚙️</span>
            <span>FX</span>
          </button>
        </div>
      </div>

      <!-- Collapsible Advanced Settings Drawer -->
      <div id="advanced-drawer" class="advanced-drawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <span>⚡</span>
            <span>CYBERWARE NEURAL TUNING</span>
          </div>
          <button id="btn-close-drawer" class="drawer-close-btn">✕</button>
        </div>

        <!-- Tabs -->
        <div class="drawer-tabs">
          <button class="tab-btn active" data-tab="tab-trails">GHOST TRAILS</button>
          <button class="tab-btn" data-tab="tab-glitch">GLITCH FX</button>
          <button class="tab-btn" data-tab="tab-optics">OPTICS & SEGMENT</button>
          <button class="tab-btn" data-tab="tab-audio">AUDIO & TRIGGER</button>
          <button class="tab-btn" data-tab="tab-system">SYSTEM</button>
        </div>

        <!-- Drawer Content -->
        <div class="drawer-body">
          <!-- TAB 1: GHOST TRAILS -->
          <div id="tab-trails" class="tab-content active">
            <div class="control-row">
              <div class="control-header">
                <span>Discrete Echo Count (Sandevistan Copies)</span>
                <span id="val-trail-count" class="control-val">4</span>
              </div>
              <input type="range" id="slider-trail-count" class="cyber-slider" min="1" max="6" value="4" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Echo Spread / Spacing</span>
                <span id="val-trail-spread" class="control-val">0.65</span>
              </div>
              <input type="range" id="slider-trail-spread" class="cyber-slider" min="10" max="100" value="65" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Trail Glow Brightness</span>
                <span id="val-trail-brightness" class="control-val">1.50</span>
              </div>
              <input type="range" id="slider-trail-brightness" class="cyber-slider" min="50" max="250" value="150" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Trail Persistence (Fade Speed)</span>
                <span id="val-trail-persist" class="control-val">0.93</span>
              </div>
              <input type="range" id="slider-trail-persist" class="cyber-slider" min="70" max="98" value="93" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Echo Lag Drift</span>
                <span id="val-trail-lag" class="control-val">0.60</span>
              </div>
              <input type="range" id="slider-trail-lag" class="cyber-slider" min="0" max="100" value="60" />
            </div>

            <div class="control-group">
              <div class="control-group-title">Ghost Echo Color Palette</div>
              <div class="presets-strip" style="justify-content: flex-start;">
                <button class="preset-pill active" data-color="0.0,1.0,0.45">EDGERUNNERS GREEN</button>
                <button class="preset-pill" data-color="0.0,0.95,0.85">CYBER CYAN</button>
                <button class="preset-pill" data-color="0.65,1.0,0.0">ACID MATRIX</button>
              </div>
            </div>
          </div>

          <!-- TAB 2: GLITCH FX -->
          <div id="tab-glitch" class="tab-content" style="display:none;">
            <div class="control-row">
              <div class="control-header">
                <span>Chromatic Aberration (RGB Split)</span>
                <span id="val-rgb-split" class="control-val">0.024</span>
              </div>
              <input type="range" id="slider-rgb-split" class="cyber-slider" min="0" max="60" value="24" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Horizontal Slice Jitter</span>
                <span id="val-slice-jitter" class="control-val">0.45</span>
              </div>
              <input type="range" id="slider-slice-jitter" class="cyber-slider" min="0" max="100" value="45" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>CRT Scanlines</span>
                <span id="val-scanlines" class="control-val">0.35</span>
              </div>
              <input type="range" id="slider-scanlines" class="cyber-slider" min="0" max="100" value="35" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Digital Speckle Noise</span>
                <span id="val-noise" class="control-val">0.25</span>
              </div>
              <input type="range" id="slider-noise" class="cyber-slider" min="0" max="100" value="25" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Pixel Sort Smear Streaks</span>
                <span id="val-pixel-sort" class="control-val">0.35</span>
              </div>
              <input type="range" id="slider-pixel-sort" class="cyber-slider" min="0" max="100" value="35" />
            </div>
          </div>

          <!-- TAB 3: OPTICS & SEGMENTATION -->
          <div id="tab-optics" class="tab-content" style="display:none;">
            <div class="cyber-switch-row">
              <div class="switch-label-wrap">
                <span style="font-weight:600;">Person Segmentation (MediaPipe)</span>
                <span class="switch-subtext">Isolates trails to subject body & desaturates background</span>
              </div>
              <div id="switch-segmentation" class="cyber-switch">
                <div class="switch-handle"></div>
              </div>
            </div>

            <div class="cyber-switch-row">
              <div class="switch-label-wrap">
                <span style="font-weight:600;">Vertical Invert (Upright Camera)</span>
                <span class="switch-subtext">Compensates camera sensor orientation (on by default)</span>
              </div>
              <div id="switch-flip-y" class="cyber-switch checked">
                <div class="switch-handle"></div>
              </div>
            </div>

            <div class="control-row" style="margin-top:12px;">
              <div class="control-header">
                <span>Background Desaturation</span>
                <span id="val-desat-bg" class="control-val">0.80</span>
              </div>
              <input type="range" id="slider-desat-bg" class="cyber-slider" min="0" max="100" value="80" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Contrast Boost</span>
                <span id="val-contrast" class="control-val">1.40</span>
              </div>
              <input type="range" id="slider-contrast" class="cyber-slider" min="100" max="220" value="140" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Green/Cyan Color Grading</span>
                <span id="val-green-grade" class="control-val">0.85</span>
              </div>
              <input type="range" id="slider-green-grade" class="cyber-slider" min="0" max="100" value="85" />
            </div>
          </div>

          <!-- TAB 4: AUDIO & TRIGGERS -->
          <div id="tab-audio" class="tab-content" style="display:none;">
            <div class="cyber-switch-row">
              <div class="switch-label-wrap">
                <span style="font-weight:600;">Auto-Trigger Reactive Spikes</span>
                <span class="switch-subtext">Automatically ramps intensity with fast movement & sound</span>
              </div>
              <div id="switch-auto-trigger" class="cyber-switch checked">
                <div class="switch-handle"></div>
              </div>
            </div>

            <div class="control-row" style="margin-top:12px;">
              <div class="control-header">
                <span>Motion Sensitivity</span>
                <span id="val-motion-sens" class="control-val">0.65</span>
              </div>
              <input type="range" id="slider-motion-sens" class="cyber-slider" min="0" max="100" value="65" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Mic Volume Audio Sensitivity</span>
                <span id="val-audio-sens" class="control-val">0.75</span>
              </div>
              <input type="range" id="slider-audio-sens" class="cyber-slider" min="0" max="100" value="75" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Loud Scream / Burst Trigger Threshold</span>
                <span id="val-scream-thresh" class="control-val">0.65</span>
              </div>
              <input type="range" id="slider-scream-thresh" class="cyber-slider" min="20" max="95" value="65" />
            </div>

            <div class="control-row">
              <div class="control-header">
                <span>Procedural Sound FX Volume</span>
                <span id="val-sfx-vol" class="control-val">0.75</span>
              </div>
              <input type="range" id="slider-sfx-vol" class="cyber-slider" min="0" max="100" value="75" />
            </div>
          </div>

          <!-- TAB 5: SYSTEM -->
          <div id="tab-system" class="tab-content" style="display:none;">
            <div class="control-group">
              <div class="control-group-title">Rendering Quality</div>
              <div class="segmented-group">
                <button class="segment-btn active" data-quality="auto">AUTO (FPS ADAPTIVE)</button>
                <button class="segment-btn" data-quality="high">HIGH (1080P)</button>
                <button class="segment-btn" data-quality="med">MED (720P)</button>
                <button class="segment-btn" data-quality="low">LOW (480P)</button>
              </div>
            </div>

            <div class="cyber-switch-row">
              <div class="switch-label-wrap">
                <span style="font-weight:600;">Cyber Watermark Badge</span>
                <span class="switch-subtext">Overlays "WebPhycossis" badge in bottom-right corner</span>
              </div>
              <div id="switch-watermark" class="cyber-switch checked">
                <div class="switch-handle"></div>
              </div>
            </div>

            <div style="margin-top: 18px; display: flex; gap: 10px;">
              <button id="btn-reset-defaults" class="btn-cyber-secondary" style="flex:1;">
                RESTORE FACTORY DEFAULTS
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Snapshot Preview Modal -->
      <div id="modal-snapshot" class="cyber-modal-backdrop">
        <div class="cyber-modal">
          <div class="modal-header">
            <span class="modal-title">OPTIC CAPTURE // SNAPSHOT</span>
            <button id="btn-close-snap-modal" class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="preview-media-container">
              <img id="snapshot-preview-img" alt="Captured Frame" />
            </div>
          </div>
          <div class="modal-actions">
            <button id="btn-discard-snap" class="btn-cyber-secondary">DISCARD</button>
            <button id="btn-share-snap" class="btn-cyber-primary">
              <span>📤</span>
              <span>SHARE / SAVE</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Video Preview Modal -->
      <div id="modal-video" class="cyber-modal-backdrop">
        <div class="cyber-modal">
          <div class="modal-header">
            <span class="modal-title">OPTIC RECORDING // VIDEO CLIP</span>
            <button id="btn-close-video-modal" class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="preview-media-container">
              <video id="video-preview-player" controls autoplay loop playsinline></video>
            </div>
          </div>
          <div class="modal-actions">
            <button id="btn-discard-video" class="btn-cyber-secondary">DISCARD / RETAKE</button>
            <button id="btn-share-video" class="btn-cyber-primary">
              <span>📤</span>
              <span>SHARE / DOWNLOAD</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Privacy & Client-side Explainer Modal -->
      <div id="modal-privacy" class="cyber-modal-backdrop">
        <div class="cyber-modal">
          <div class="modal-header">
            <span class="modal-title">CYBERWARE PRIVACY PROTOCOL</span>
            <button id="btn-close-privacy-modal" class="modal-close">✕</button>
          </div>
          <div class="modal-body" style="font-size: 14px; line-height: 1.6; color: #c8e0d4; text-align: left;">
            <p><strong>100% Client-Side Neural Processing:</strong></p>
            <p>WebPhycossis runs entirely in your local browser using hardware-accelerated WebGL fragment shaders and on-device WebAssembly.</p>
            <ul style="padding-left: 20px; margin: 10px 0;">
              <li>No video frames, camera feeds, or audio signals ever leave your machine.</li>
              <li>No backend servers, cloud processors, or external APIs are used.</li>
              <li>Recordings and snapshots are generated directly in your browser's local memory.</li>
            </ul>
            <p style="color: var(--neon-green); font-family: var(--font-mono); font-size: 12px;">STATUS: ZERO TELEMETRY // SECURE OPTIC</p>
          </div>
          <div class="modal-actions">
            <button id="btn-dismiss-privacy" class="btn-cyber-primary">UNDERSTOOD</button>
          </div>
        </div>
      </div>

      <!-- Toast Element -->
      <div id="cyber-toast" class="cyber-toast"></div>
    `;

    // Query key elements
    this.canvas = this.appRoot.querySelector('#gl-canvas') as HTMLCanvasElement;
    this.video = this.appRoot.querySelector('#webcam-video') as HTMLVideoElement;
    this.hudContainer = this.appRoot.querySelector('#hud-overlay') as HTMLElement;
    this.recordBtn = this.appRoot.querySelector('#btn-record') as HTMLElement;
    this.micBtn = this.appRoot.querySelector('#btn-mic') as HTMLElement;
    this.mirrorBtn = this.appRoot.querySelector('#btn-mirror') as HTMLElement;
    this.hudBtn = this.appRoot.querySelector('#btn-toggle-hud') as HTMLElement;
    this.fullscreenBtn = this.appRoot.querySelector('#btn-toggle-fullscreen') as HTMLElement;
    this.masterSlider = this.appRoot.querySelector('#master-intensity-slider') as HTMLInputElement;
    this.masterValBadge = this.appRoot.querySelector('#master-intensity-val') as HTMLElement;
    this.drawer = this.appRoot.querySelector('#advanced-drawer') as HTMLElement;
    this.toastEl = this.appRoot.querySelector('#cyber-toast') as HTMLElement;

    // Modals
    this.snapshotModal = this.appRoot.querySelector('#modal-snapshot') as HTMLElement;
    this.snapshotImg = this.appRoot.querySelector('#snapshot-preview-img') as HTMLImageElement;
    this.videoModal = this.appRoot.querySelector('#modal-video') as HTMLElement;
    this.previewVideo = this.appRoot.querySelector('#video-preview-player') as HTMLVideoElement;
    this.privacyModal = this.appRoot.querySelector('#modal-privacy') as HTMLElement;
  }

  private bindEvents(): void {
    // 1. Master Slider
    this.masterSlider.addEventListener('input', () => {
      const val = parseInt(this.masterSlider.value, 10) / 100;
      this.settings.masterIntensity = val;
      this.masterValBadge.textContent = `${this.masterSlider.value}%`;
      this.callbacks.onSettingsChange(this.settings);
      saveCustomSettings(this.settings);
    });

    // Mode Switcher Pills
    const modePills = this.appRoot.querySelectorAll('.mode-pill[data-mode]');
    modePills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const mode = pill.getAttribute('data-mode') as 'motion_trails' | 'overlay';
        if (mode) {
          modePills.forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
          this.settings.effectMode = mode;
          this.callbacks.onSettingsChange(this.settings);
          saveCustomSettings(this.settings);
          this.showToast(
            mode === 'motion_trails'
              ? 'Mode: MOTION TRAILS (Clean subject + motion ghost echoes)'
              : 'Mode: OVERLAY (Full-frame cyberpsychosis)'
          );
        }
      });
    });

    // 2. Presets Pills
    const presetPills = this.appRoot.querySelectorAll('.preset-pill[data-preset]');
    presetPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const pKey = pill.getAttribute('data-preset');
        if (pKey && PRESETS[pKey]) {
          presetPills.forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');

          const targetPreset = PRESETS[pKey];
          this.applyPreset(targetPreset);
          this.callbacks.onPresetSelect(targetPreset);
        }
      });
    });

    // 3. Action Buttons
    this.recordBtn.addEventListener('click', () => this.callbacks.onRecordToggle());
    this.appRoot.querySelector('#btn-snapshot')?.addEventListener('click', () => this.callbacks.onSnapshot());
    this.appRoot.querySelector('#btn-sandevistan-burst')?.addEventListener('click', () => this.callbacks.onSandevistanBurst());
    this.micBtn.addEventListener('click', () => this.callbacks.onMicToggle());
    this.appRoot.querySelector('#btn-flip-cam')?.addEventListener('click', () => this.callbacks.onCameraFlip());
    this.mirrorBtn.addEventListener('click', () => this.callbacks.onMirrorToggle());
    this.hudBtn.addEventListener('click', () => this.callbacks.onHudToggle());

    // Fullscreen
    this.fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Privacy badge
    this.appRoot.querySelector('#btn-privacy-badge')?.addEventListener('click', () => {
      this.privacyModal.classList.add('open');
    });
    this.appRoot.querySelector('#btn-close-privacy-modal')?.addEventListener('click', () => {
      this.privacyModal.classList.remove('open');
    });
    this.appRoot.querySelector('#btn-dismiss-privacy')?.addEventListener('click', () => {
      this.privacyModal.classList.remove('open');
    });

    // Advanced Drawer Toggle & Close
    this.appRoot.querySelector('#btn-advanced')?.addEventListener('click', () => {
      this.drawer.classList.toggle('open');
    });
    this.appRoot.querySelector('#btn-close-drawer')?.addEventListener('click', () => {
      this.drawer.classList.remove('open');
    });

    // Drawer Tabs
    const tabBtns = this.appRoot.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const tabId = btn.getAttribute('data-tab');
        const contents = this.appRoot.querySelectorAll('.tab-content');
        contents.forEach((c) => ((c as HTMLElement).style.display = 'none'));
        if (tabId) {
          const activeContent = this.appRoot.querySelector(`#${tabId}`) as HTMLElement;
          if (activeContent) activeContent.style.display = 'block';
        }
      });
    });

    // Sliders in Drawer
    this.bindRangeSlider('slider-trail-count', 'val-trail-count', 1, (v) => {
      this.settings.trailCount = Math.round(v);
    });
    this.bindRangeSlider('slider-trail-spread', 'val-trail-spread', 100, (v) => {
      this.settings.trailSpread = v;
    });
    this.bindRangeSlider('slider-trail-brightness', 'val-trail-brightness', 100, (v) => {
      this.settings.trailBrightness = v;
    });
    this.bindRangeSlider('slider-trail-persist', 'val-trail-persist', 100, (v) => {
      this.settings.trailPersistence = v;
    });
    this.bindRangeSlider('slider-trail-lag', 'val-trail-lag', 100, (v) => {
      this.settings.trailLag = v;
    });
    this.bindRangeSlider('slider-rgb-split', 'val-rgb-split', 1000, (v) => {
      this.settings.rgbSplit = v;
    });
    this.bindRangeSlider('slider-slice-jitter', 'val-slice-jitter', 100, (v) => {
      this.settings.sliceJitter = v;
    });
    this.bindRangeSlider('slider-scanlines', 'val-scanlines', 100, (v) => {
      this.settings.scanlines = v;
    });
    this.bindRangeSlider('slider-noise', 'val-noise', 100, (v) => {
      this.settings.noise = v;
    });
    this.bindRangeSlider('slider-pixel-sort', 'val-pixel-sort', 100, (v) => {
      this.settings.pixelSort = v;
    });
    this.bindRangeSlider('slider-contrast', 'val-contrast', 100, (v) => {
      this.settings.contrast = v;
    });
    this.bindRangeSlider('slider-green-grade', 'val-green-grade', 100, (v) => {
      this.settings.greenGrade = v;
    });
    this.bindRangeSlider('slider-desat-bg', 'val-desat-bg', 100, (v) => {
      this.settings.desatBg = v;
    });
    this.bindRangeSlider('slider-motion-sens', 'val-motion-sens', 100, (v) => {
      this.settings.motionSensitivity = v;
    });
    this.bindRangeSlider('slider-audio-sens', 'val-audio-sens', 100, (v) => {
      this.settings.audioSensitivity = v;
    });
    this.bindRangeSlider('slider-scream-thresh', 'val-scream-thresh', 100, (v) => {
      this.settings.screamThreshold = v;
    });
    this.bindRangeSlider('slider-sfx-vol', 'val-sfx-vol', 100, (v) => {
      this.settings.sfxVolume = v;
    });

    // Color buttons
    const colorBtns = this.appRoot.querySelectorAll('button[data-color]');
    colorBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        colorBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const colStr = btn.getAttribute('data-color') || '0.0,1.0,0.45';
        const parts = colStr.split(',').map((p) => parseFloat(p));
        this.settings.trailColor = [parts[0], parts[1], parts[2]];
        this.callbacks.onSettingsChange(this.settings);
        saveCustomSettings(this.settings);
      });
    });

    // Switches
    this.bindSwitch('switch-segmentation', (checked) => {
      this.settings.useSegmentation = checked;
      this.callbacks.onSettingsChange(this.settings);
      saveCustomSettings(this.settings);
    });

    this.bindSwitch('switch-flip-y', (checked) => {
      this.settings.flipY = checked;
      this.callbacks.onSettingsChange(this.settings);
      saveCustomSettings(this.settings);
    });

    this.bindSwitch('switch-auto-trigger', (checked) => {
      this.settings.autoTrigger = checked;
      this.callbacks.onSettingsChange(this.settings);
      saveCustomSettings(this.settings);
    });

    this.bindSwitch('switch-watermark', (checked) => {
      this.settings.watermark = checked;
      this.callbacks.onSettingsChange(this.settings);
      saveCustomSettings(this.settings);
    });

    // Quality buttons
    const qualityBtns = this.appRoot.querySelectorAll('.segment-btn[data-quality]');
    qualityBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        qualityBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const q = (btn.getAttribute('data-quality') || 'auto') as QualityLevel;
        this.settings.quality = q;
        this.callbacks.onQualityChange(q);
        saveCustomSettings(this.settings);
      });
    });

    // Reset defaults
    this.appRoot.querySelector('#btn-reset-defaults')?.addEventListener('click', () => {
      this.settings = { ...DEFAULT_SETTINGS };
      this.syncControls();
      this.callbacks.onSettingsChange(this.settings);
      saveCustomSettings(this.settings);
      this.showToast('Restored Factory Cyberware Defaults');
    });

    // Snapshot Modal Buttons
    this.appRoot.querySelector('#btn-close-snap-modal')?.addEventListener('click', () => {
      this.snapshotModal.classList.remove('open');
    });
    this.appRoot.querySelector('#btn-discard-snap')?.addEventListener('click', () => {
      this.snapshotModal.classList.remove('open');
    });
    this.appRoot.querySelector('#btn-share-snap')?.addEventListener('click', async () => {
      if (this.currentBlob) {
        const res = await RecorderManager.shareOrDownload(
          this.currentBlob,
          this.currentFilename || 'webphycossis-snapshot.png',
          'WebPhycossis Glitch Snapshot'
        );
        this.showToast(res === 'shared' ? 'Shared successfully!' : 'Snapshot downloaded!');
        this.snapshotModal.classList.remove('open');
      }
    });

    // Video Modal Buttons
    this.appRoot.querySelector('#btn-close-video-modal')?.addEventListener('click', () => {
      this.videoModal.classList.remove('open');
      this.previewVideo.pause();
    });
    this.appRoot.querySelector('#btn-discard-video')?.addEventListener('click', () => {
      this.videoModal.classList.remove('open');
      this.previewVideo.pause();
    });
    this.appRoot.querySelector('#btn-share-video')?.addEventListener('click', async () => {
      if (this.currentBlob) {
        const res = await RecorderManager.shareOrDownload(
          this.currentBlob,
          this.currentFilename || 'webphycossis-recording.mp4',
          'WebPhycossis Glitch Video'
        );
        this.showToast(res === 'shared' ? 'Video shared!' : 'Video downloaded!');
        this.videoModal.classList.remove('open');
        this.previewVideo.pause();
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.callbacks.onSandevistanBurst();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.callbacks.onRecordToggle();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        this.callbacks.onSnapshot();
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        this.callbacks.onHudToggle();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        this.callbacks.onMicToggle();
      } else if (e.code === 'Escape') {
        this.drawer.classList.remove('open');
        this.snapshotModal.classList.remove('open');
        this.videoModal.classList.remove('open');
        this.privacyModal.classList.remove('open');
        this.previewVideo.pause();
      }
    });
  }

  private bindRangeSlider(
    sliderId: string,
    valBadgeId: string,
    divisor: number,
    setter: (val: number) => void
  ): void {
    const slider = this.appRoot.querySelector(`#${sliderId}`) as HTMLInputElement | null;
    const badge = this.appRoot.querySelector(`#${valBadgeId}`) as HTMLElement | null;
    if (!slider || !badge) return;

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value) / divisor;
      setter(v);
      badge.textContent = v.toFixed(divisor >= 1000 ? 3 : 2);
      this.callbacks.onSettingsChange(this.settings);
      saveCustomSettings(this.settings);
    });
  }

  private bindSwitch(switchId: string, onChange: (checked: boolean) => void): void {
    const sw = this.appRoot.querySelector(`#${switchId}`) as HTMLElement | null;
    if (!sw) return;

    sw.addEventListener('click', () => {
      const isChecked = sw.classList.toggle('checked');
      onChange(isChecked);
    });
  }

  public applyPreset(preset: Preset): void {
    this.settings = { ...this.settings, ...preset.settings };
    this.syncControls();
    this.callbacks.onSettingsChange(this.settings);
    this.showToast(`Neural Preset: ${preset.name}`);
  }

  public syncControls(): void {
    this.masterSlider.value = String(Math.round(this.settings.masterIntensity * 100));
    this.masterValBadge.textContent = `${this.masterSlider.value}%`;

    const setSlider = (id: string, badgeId: string, val: number, divisor: number) => {
      const s = this.appRoot.querySelector(`#${id}`) as HTMLInputElement | null;
      const b = this.appRoot.querySelector(`#${badgeId}`) as HTMLElement | null;
      if (s) s.value = String(Math.round(val * divisor));
      if (b) b.textContent = val.toFixed(divisor >= 1000 ? 3 : 2);
    };

    // Mode pills active state
    const modePills = this.appRoot.querySelectorAll('.mode-pill[data-mode]');
    modePills.forEach((p) => {
      if (p.getAttribute('data-mode') === this.settings.effectMode) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    setSlider('slider-trail-count', 'val-trail-count', this.settings.trailCount ?? 4, 1);
    setSlider('slider-trail-spread', 'val-trail-spread', this.settings.trailSpread ?? 0.65, 100);
    setSlider('slider-trail-brightness', 'val-trail-brightness', this.settings.trailBrightness ?? 1.5, 100);
    setSlider('slider-trail-persist', 'val-trail-persist', this.settings.trailPersistence, 100);
    setSlider('slider-trail-lag', 'val-trail-lag', this.settings.trailLag, 100);
    setSlider('slider-rgb-split', 'val-rgb-split', this.settings.rgbSplit, 1000);
    setSlider('slider-slice-jitter', 'val-slice-jitter', this.settings.sliceJitter, 100);
    setSlider('slider-scanlines', 'val-scanlines', this.settings.scanlines, 100);
    setSlider('slider-noise', 'val-noise', this.settings.noise, 100);
    setSlider('slider-pixel-sort', 'val-pixel-sort', this.settings.pixelSort, 100);
    setSlider('slider-contrast', 'val-contrast', this.settings.contrast, 100);
    setSlider('slider-green-grade', 'val-green-grade', this.settings.greenGrade, 100);
    setSlider('slider-desat-bg', 'val-desat-bg', this.settings.desatBg, 100);
    setSlider('slider-motion-sens', 'val-motion-sens', this.settings.motionSensitivity, 100);
    setSlider('slider-audio-sens', 'val-audio-sens', this.settings.audioSensitivity, 100);
    setSlider('slider-scream-thresh', 'val-scream-thresh', this.settings.screamThreshold, 100);
    setSlider('slider-sfx-vol', 'val-sfx-vol', this.settings.sfxVolume, 100);

    const setSw = (id: string, checked: boolean) => {
      const sw = this.appRoot.querySelector(`#${id}`) as HTMLElement | null;
      if (sw) {
        if (checked) sw.classList.add('checked');
        else sw.classList.remove('checked');
      }
    };

    setSw('switch-segmentation', this.settings.useSegmentation);
    setSw('switch-flip-y', this.settings.flipY !== false);
    setSw('switch-auto-trigger', this.settings.autoTrigger);
    setSw('switch-watermark', this.settings.watermark);

    // Mirror button active state
    if (this.settings.mirror) {
      this.mirrorBtn.classList.add('active');
    } else {
      this.mirrorBtn.classList.remove('active');
    }
  }

  public setRecordingUi(isRecording: boolean): void {
    if (isRecording) {
      this.recordBtn.classList.add('recording');
    } else {
      this.recordBtn.classList.remove('recording');
    }
  }

  public setMicUi(isActive: boolean): void {
    if (isActive) {
      this.micBtn.classList.add('active');
    } else {
      this.micBtn.classList.remove('active');
    }
  }

  public setMirrorUi(isMirror: boolean): void {
    this.settings.mirror = isMirror;
    if (isMirror) {
      this.mirrorBtn.classList.add('active');
    } else {
      this.mirrorBtn.classList.remove('active');
    }
  }

  public setHudUi(isVisible: boolean): void {
    if (isVisible) {
      this.hudBtn.classList.add('active');
    } else {
      this.hudBtn.classList.remove('active');
    }
  }

  public showSnapshotModal(dataUrl: string, blobPromise: Promise<Blob | null>): void {
    this.snapshotImg.src = dataUrl;
    this.snapshotModal.classList.add('open');
    this.currentFilename = `webphycossis-${Date.now()}.png`;

    blobPromise.then((b) => {
      this.currentBlob = b;
    });
  }

  public showVideoModal(blob: Blob, mimeType: string, url: string): void {
    this.currentBlob = blob;
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    this.currentFilename = `webphycossis-${Date.now()}.${ext}`;

    this.previewVideo.src = url;
    this.previewVideo.play().catch(() => {});
    this.videoModal.classList.add('open');
  }

  public showToast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2800);
  }
}
