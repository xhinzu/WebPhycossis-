export class AudioManager {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private micGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.75;
  private micEnabled: boolean = false;
  private micSensitivity: number = 0.7;
  private screamThreshold: number = 0.65;
  private lastScreamTime: number = 0;

  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;

  public onScreamDetected: (() => void) | null = null;

  constructor() {
    // AudioContext will be initialized on user gesture
  }

  public async initContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Destination for video recorder mixing
      this.streamDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.streamDest);
      this.masterGain.connect(this.ctx.destination);

      // Pre-generate noise buffer
      this.generateNoiseBuffer();
      this.initAmbientHum();
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    return this.ctx;
  }

  private generateNoiseBuffer(): void {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  private initAmbientHum(): void {
    if (!this.ctx || !this.sfxGain) return;
    try {
      this.humOsc = this.ctx.createOscillator();
      this.humOsc.type = 'sawtooth';
      this.humOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.humGain = this.ctx.createGain();
      this.humGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.humOsc.connect(filter);
      filter.connect(this.humGain);
      this.humGain.connect(this.sfxGain);

      this.humOsc.start();
    } catch (e) {
      console.warn('Ambient hum setup error:', e);
    }
  }

  public updateHum(intensity: number): void {
    if (!this.humGain || !this.ctx) return;
    const targetGain = Math.max(0, (intensity - 0.3) * 0.15);
    this.humGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
  }

  public async toggleMic(): Promise<boolean> {
    await this.initContext();

    if (this.micEnabled) {
      this.stopMic();
      return false;
    } else {
      const success = await this.startMic();
      return success;
    }
  }

  public async startMic(): Promise<boolean> {
    await this.initContext();
    if (!this.ctx || !this.masterGain) return false;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;

      this.micGain = this.ctx.createGain();
      // Keep mic gain in local speakers at 0 to prevent audio feedback screech,
      // but feed into recorder stream destination!
      this.micGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      this.micSource.connect(this.analyser);
      if (this.streamDest) {
        this.micSource.connect(this.micGain);
        this.micGain.connect(this.streamDest);
      }

      this.micEnabled = true;
      return true;
    } catch (err) {
      console.warn('Mic access failed:', err);
      this.micEnabled = false;
      return false;
    }
  }

  public stopMic(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }
    this.micEnabled = false;
  }

  public isMicActive(): boolean {
    return this.micEnabled;
  }

  public getAudioLevel(): number {
    if (!this.micEnabled || !this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const normalized = Math.min(1.0, rms * (this.micSensitivity * 6.0));

    // Check for scream trigger
    if (normalized > this.screamThreshold && performance.now() - this.lastScreamTime > 1200) {
      this.lastScreamTime = performance.now();
      if (this.onScreamDetected) {
        this.onScreamDetected();
      }
    }

    return normalized;
  }

  public playSandevistan(): void {
    if (this.isMuted) return;
    this.initContext().then(() => {
      if (!this.ctx || !this.sfxGain) return;
      const now = this.ctx.currentTime;

      // 1. Sub-bass drop
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(160, now);
      sub.frequency.exponentialRampToValueAtTime(32, now + 0.65);

      subGain.gain.setValueAtTime(0.8, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      sub.connect(subGain);
      subGain.connect(this.sfxGain);
      sub.start(now);
      sub.stop(now + 0.7);

      // 2. High-speed turbine whine
      const turbine = this.ctx.createOscillator();
      const turbineFilter = this.ctx.createBiquadFilter();
      const turbineGain = this.ctx.createGain();

      turbine.type = 'sawtooth';
      turbine.frequency.setValueAtTime(280, now);
      turbine.frequency.exponentialRampToValueAtTime(3200, now + 0.5);

      turbineFilter.type = 'bandpass';
      turbineFilter.frequency.setValueAtTime(450, now);
      turbineFilter.frequency.exponentialRampToValueAtTime(4500, now + 0.5);
      turbineFilter.Q.setValueAtTime(6.0, now);

      turbineGain.gain.setValueAtTime(0.01, now);
      turbineGain.gain.linearRampToValueAtTime(0.6, now + 0.15);
      turbineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      turbine.connect(turbineFilter);
      turbineFilter.connect(turbineGain);
      turbineGain.connect(this.sfxGain);
      turbine.start(now);
      turbine.stop(now + 0.65);

      // 3. Cybernetic resonance burst
      this.playGlitchBurst(0.7);
    });
  }

  public playGlitchBurst(customVol = 0.5): void {
    if (this.isMuted) return;
    this.initContext().then(() => {
      if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
      const now = this.ctx.currentTime;

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800 + Math.random() * 2400, now);
      filter.Q.setValueAtTime(4.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(customVol * 0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noiseSource.start(now);
      noiseSource.stop(now + 0.2);
    });
  }

  public playClick(): void {
    if (this.isMuted) return;
    this.initContext().then(() => {
      if (!this.ctx || !this.sfxGain) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.04);
    });
  }

  public playFlatlineAlarm(): void {
    if (this.isMuted) return;
    this.initContext().then(() => {
      if (!this.ctx || !this.sfxGain) return;
      const now = this.ctx.currentTime;

      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(1760, now + 0.1);

      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc1.connect(gain1);
      gain1.connect(this.sfxGain);
      osc1.start(now);
      osc1.stop(now + 0.3);
    });
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public setMicSensitivity(val: number): void {
    this.micSensitivity = Math.max(0, Math.min(1, val));
  }

  public setScreamThreshold(val: number): void {
    this.screamThreshold = Math.max(0.1, Math.min(1, val));
  }

  public getMixedAudioStream(): MediaStream | null {
    return this.streamDest ? this.streamDest.stream : null;
  }
}
