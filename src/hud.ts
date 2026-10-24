export interface HudStats {
  fps: number;
  quality: string;
  renderWidth: number;
  renderHeight: number;
  intensity: number;
  audioLevel: number;
  isRecording: boolean;
  recordingTime: string;
  hasSegmentation: boolean;
  mode?: string;
}

export class HudManager {
  private container: HTMLElement;
  private modeTag: HTMLElement | null = null;
  private levelFill: HTMLElement | null = null;
  private levelPct: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  private fpsDisplay: HTMLElement | null = null;
  private qualityBadge: HTMLElement | null = null;
  private resDisplay: HTMLElement | null = null;
  private recBadge: HTMLElement | null = null;
  private audioBar: HTMLElement | null = null;
  private flatlineBanner: HTMLElement | null = null;
  private isVisible: boolean = true;

  constructor(container: HTMLElement) {
    this.container = container;
    this.buildHudDom();
  }

  private buildHudDom(): void {
    this.container.innerHTML = `
      <div class="hud-corners top-left"></div>
      <div class="hud-corners top-right"></div>
      <div class="hud-corners bottom-left"></div>
      <div class="hud-corners bottom-right"></div>

      <!-- Reticle Crosshairs -->
      <div class="hud-crosshair-center">
        <div class="crosshair-ring"></div>
        <div class="crosshair-bracket left"></div>
        <div class="crosshair-bracket right"></div>
      </div>

      <!-- Top Status Bar -->
      <div class="hud-top-bar">
        <div class="hud-section left-info">
          <span class="hud-tag">KIROSHI OPTICS v4.8</span>
          <span class="hud-subtag" id="hud-mode-tag">MODE: GHOST-SV</span>
        </div>

        <div class="hud-section center-alert">
          <div id="hud-flatline-banner" class="hud-flatline-banner hidden">
            ⚠️ FLATLINE IMMINENT // PURGE CYBERWARE NOW ⚠️
          </div>
        </div>

        <div class="hud-section right-stats">
          <div id="hud-rec-badge" class="hud-rec-badge hidden">
            <span class="rec-dot"></span>
            <span id="hud-rec-timer">REC 00:00</span>
          </div>
          <div class="hud-metrics">
            <span id="hud-fps">FPS: 60</span>
            <span class="hud-divider">|</span>
            <span id="hud-quality">Q: HIGH</span>
            <span class="hud-divider">|</span>
            <span id="hud-res">1280x720</span>
          </div>
        </div>
      </div>

      <!-- Left Cyberpsychosis Level Gauge -->
      <div class="hud-level-gauge">
        <div class="gauge-header">
          <span class="gauge-title">CYBERPSYCHOSIS LOAD</span>
          <span id="hud-level-pct" class="gauge-pct">65%</span>
        </div>
        <div class="gauge-bar-track">
          <div id="hud-level-fill" class="gauge-bar-fill" style="height: 65%;"></div>
          <div class="gauge-ticks">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
        <div id="hud-status-text" class="gauge-status-text">
          WARNING // NEURAL SPIKE DETECTED
        </div>
      </div>

      <!-- Audio Meter (Bottom Left) -->
      <div class="hud-audio-meter">
        <span class="meter-label">NEURAL MIC</span>
        <div class="audio-track">
          <div id="hud-audio-bar" class="audio-fill" style="width: 0%;"></div>
        </div>
      </div>
    `;

    this.modeTag = this.container.querySelector('#hud-mode-tag');
    this.levelFill = this.container.querySelector('#hud-level-fill');
    this.levelPct = this.container.querySelector('#hud-level-pct');
    this.statusText = this.container.querySelector('#hud-status-text');
    this.fpsDisplay = this.container.querySelector('#hud-fps');
    this.qualityBadge = this.container.querySelector('#hud-quality');
    this.resDisplay = this.container.querySelector('#hud-res');
    this.recBadge = this.container.querySelector('#hud-rec-badge');
    this.audioBar = this.container.querySelector('#hud-audio-bar');
    this.flatlineBanner = this.container.querySelector('#hud-flatline-banner');
  }

  public update(stats: HudStats): void {
    if (!this.isVisible) return;

    if (this.modeTag && stats.mode) {
      this.modeTag.textContent = stats.mode;
    }

    // 1. Intensity / Cyberpsychosis Level
    const pct = Math.round(stats.intensity * 100);
    if (this.levelFill) {
      this.levelFill.style.height = `${pct}%`;
    }
    if (this.levelPct) {
      this.levelPct.textContent = `${pct}%`;
    }

    // Status text & Color coding
    if (this.statusText) {
      if (pct < 30) {
        this.statusText.textContent = 'STABLE // OPTICS NORMAL';
        this.statusText.className = 'gauge-status-text stable';
      } else if (pct < 75) {
        this.statusText.textContent = 'WARNING // NEURAL SPIKE DETECTED';
        this.statusText.className = 'gauge-status-text warning';
      } else if (pct < 95) {
        this.statusText.textContent = 'CRITICAL // CYBERPSYCHOSIS IMMINENT';
        this.statusText.className = 'gauge-status-text critical';
      } else {
        this.statusText.textContent = 'FLATLINE IMMINENT // PURGE CYBERWARE NOW';
        this.statusText.className = 'gauge-status-text flatline';
      }
    }

    // Flatline banner
    if (this.flatlineBanner) {
      if (pct >= 95) {
        this.flatlineBanner.classList.remove('hidden');
      } else {
        this.flatlineBanner.classList.add('hidden');
      }
    }

    // Performance Stats
    if (this.fpsDisplay) {
      this.fpsDisplay.textContent = `FPS: ${stats.fps}`;
    }
    if (this.qualityBadge) {
      this.qualityBadge.textContent = `Q: ${stats.quality.toUpperCase()}`;
    }
    if (this.resDisplay) {
      this.resDisplay.textContent = `${stats.renderWidth}x${stats.renderHeight}`;
    }

    // Recording status
    if (this.recBadge) {
      if (stats.isRecording) {
        this.recBadge.classList.remove('hidden');
        const timerSpan = this.recBadge.querySelector('#hud-rec-timer');
        if (timerSpan) {
          timerSpan.textContent = `REC ${stats.recordingTime}`;
        }
      } else {
        this.recBadge.classList.add('hidden');
      }
    }

    // Audio level
    if (this.audioBar) {
      const audioPct = Math.round(stats.audioLevel * 100);
      this.audioBar.style.width = `${audioPct}%`;
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
    }
  }

  public toggle(): boolean {
    this.setVisible(!this.isVisible);
    return this.isVisible;
  }
}
