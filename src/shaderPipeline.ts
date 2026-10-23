import type { EffectSettings, QualityLevel } from './types';
import { quadVertexShader } from './shaders/quad.vert';
import { feedbackFragmentShader } from './shaders/feedback.frag';
import { compositeFragmentShader } from './shaders/composite.frag';

export class ShaderPipeline {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;

  private quadBuffer: WebGLBuffer | null = null;
  private feedbackProgram: WebGLProgram | null = null;
  private compositeProgram: WebGLProgram | null = null;

  // Textures
  private videoTexture: WebGLTexture | null = null;
  private prevVideoTexture: WebGLTexture | null = null;
  private maskTexture: WebGLTexture | null = null;
  private watermarkTexture: WebGLTexture | null = null;

  // Ping-Pong FBOs for Ghost Feedback loop
  private fbos: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
  private fboTextures: [WebGLTexture, WebGLTexture] | null = null;
  private currentFboIndex: number = 0;

  // Frame dimension & resolution scaling
  private baseWidth: number = 1280;
  private baseHeight: number = 720;
  private renderWidth: number = 1280;
  private renderHeight: number = 720;
  private qualityScale: number = 1.0;

  // Shockwave state
  private shockwaveRadius: number = 0.0;
  private isShockwaveActive: boolean = false;
  private shockwavePos: [number, number] = [0.5, 0.5];

  // Performance & Auto-quality tracking
  private lastFrameTime: number = performance.now();
  private frameCount: number = 0;
  private fps: number = 60;
  private lowFpsCounter: number = 0;
  private highFpsCounter: number = 0;
  private autoQualityLevel: 'high' | 'med' | 'low' = 'high';

  // Uniform locations cache
  private feedbackUniforms: Record<string, WebGLUniformLocation | null> = {};
  private compositeUniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const gl =
      canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        preserveDrawingBuffer: true, // Crucial for snapshots & screen capture
      }) ||
      (canvas.getContext('experimental-webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        preserveDrawingBuffer: true,
      }) as WebGLRenderingContext | null);

    if (!gl) {
      throw new Error('WebGL not supported on this browser or graphics card.');
    }
    this.gl = gl;

    this.initPipeline();
  }

  private initPipeline(): void {
    const gl = this.gl;

    // Enable OES_texture_float or extensions if available
    gl.getExtension('OES_texture_float');
    gl.getExtension('OES_texture_half_float');

    // 1. Create Quad Buffer
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const quadVertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    // 2. Compile Programs
    this.feedbackProgram = this.createProgram(quadVertexShader, feedbackFragmentShader);
    this.compositeProgram = this.createProgram(quadVertexShader, compositeFragmentShader);

    // 3. Cache Uniform Locations
    this.cacheUniforms();

    // 4. Create Video and Mask Textures
    this.videoTexture = this.createTexture();
    this.prevVideoTexture = this.createTexture();
    this.maskTexture = this.createTexture();

    // Fill initial 1x1 white mask texture (full-frame fallback)
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255])
    );

    // 5. Create Watermark Texture
    this.watermarkTexture = this.createWatermarkTexture();

    // 6. Setup FBOs
    this.setupFBOs(this.renderWidth, this.renderHeight);
  }

  private cacheUniforms(): void {
    const gl = this.gl;
    if (this.feedbackProgram) {
      const uList = [
        'u_currentFrame',
        'u_prevFrame',
        'u_feedback',
        'u_mask',
        'u_useMask',
        'u_persistence',
        'u_decay',
        'u_intensity',
        'u_time',
        'u_trailColor',
        'u_trailLag',
        'u_resolution',
        'u_mirror',
      ];
      for (const name of uList) {
        this.feedbackUniforms[name] = gl.getUniformLocation(this.feedbackProgram, name);
      }
    }

    if (this.compositeProgram) {
      const uList = [
        'u_video',
        'u_feedback',
        'u_mask',
        'u_watermarkTex',
        'u_useMask',
        'u_watermark',
        'u_intensity',
        'u_time',
        'u_rgbSplit',
        'u_sliceJitter',
        'u_scanlines',
        'u_noise',
        'u_pixelSort',
        'u_contrast',
        'u_greenGrade',
        'u_desatBg',
        'u_shockwave',
        'u_shockwavePos',
        'u_resolution',
        'u_mirror',
      ];
      for (const name of uList) {
        this.compositeUniforms[name] = gl.getUniformLocation(this.compositeProgram, name);
      }
    }
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }
    return shader;
  }

  private createProgram(vertSrc: string, fragSrc: string): WebGLProgram {
    const gl = this.gl;
    const vert = this.createShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this.createShader(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    if (!prog) throw new Error('Failed to create program');
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`Program link error: ${info}`);
    }
    return prog;
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create texture');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  private createWatermarkTexture(): WebGLTexture {
    const gl = this.gl;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 480;
    offCanvas.height = 88;
    const ctx = offCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 480, 88);

      // Cyberpunk box background
      ctx.fillStyle = 'rgba(10, 15, 20, 0.85)';
      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(4, 4, 472, 80);
      ctx.fill();
      ctx.stroke();

      // Cyber corner accents
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(4, 4, 12, 4);
      ctx.fillRect(4, 4, 4, 12);
      ctx.fillRect(464, 76, 12, 4);
      ctx.fillRect(472, 68, 4, 12);

      // Title
      ctx.font = 'bold 26px "Orbitron", "Rajdhani", monospace, sans-serif';
      ctx.fillStyle = '#00ff66';
      ctx.shadowColor = '#00ff66';
      ctx.shadowBlur = 10;
      ctx.fillText('⚡ WEBPHYCOSSIS', 18, 38);

      // Subtitle
      ctx.shadowBlur = 0;
      ctx.font = '14px "Share Tech Mono", monospace, sans-serif';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('SANDEVISTAN // CLIENT-SIDE OPTICS', 20, 68);
    }

    const tex = this.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offCanvas);
    return tex;
  }

  private setupFBOs(width: number, height: number): void {
    const gl = this.gl;

    // Delete existing FBOs if any
    if (this.fbos) {
      gl.deleteFramebuffer(this.fbos[0]);
      gl.deleteFramebuffer(this.fbos[1]);
    }
    if (this.fboTextures) {
      gl.deleteTexture(this.fboTextures[0]);
      gl.deleteTexture(this.fboTextures[1]);
    }

    const texA = this.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fboA = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0);

    // Clear initial buffer to black
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const texB = this.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fboB = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texB, 0);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.fbos = [fboA, fboB];
    this.fboTextures = [texA, texB];
    this.currentFboIndex = 0;
  }

  public setVideoDimensions(width: number, height: number): void {
    this.baseWidth = width;
    this.baseHeight = height;
    this.updateResolutionScale();
  }

  public setQuality(quality: QualityLevel): void {
    if (quality === 'high') {
      this.qualityScale = 1.0;
    } else if (quality === 'med') {
      this.qualityScale = 0.75;
    } else if (quality === 'low') {
      this.qualityScale = 0.5;
    } else {
      // Auto mode
      this.qualityScale = this.autoQualityLevel === 'high' ? 1.0 : this.autoQualityLevel === 'med' ? 0.75 : 0.5;
    }
    this.updateResolutionScale();
  }

  private updateResolutionScale(): void {
    const newWidth = Math.max(320, Math.round(this.baseWidth * this.qualityScale));
    const newHeight = Math.max(240, Math.round(this.baseHeight * this.qualityScale));

    if (newWidth !== this.renderWidth || newHeight !== this.renderHeight) {
      this.renderWidth = newWidth;
      this.renderHeight = newHeight;
      this.canvas.width = newWidth;
      this.canvas.height = newHeight;
      this.setupFBOs(newWidth, newHeight);
    }
  }

  public updateMask(floatData: Float32Array, width: number, height: number): void {
    const gl = this.gl;
    if (!this.maskTexture) return;

    // Convert Float32 confidence mask [0..1] to Uint8Array [0..255]
    const uint8 = new Uint8Array(width * height);
    for (let i = 0; i < floatData.length; i++) {
      uint8[i] = Math.min(255, Math.max(0, Math.round(floatData[i] * 255)));
    }

    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      width,
      height,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      uint8
    );
  }

  public triggerShockwave(): void {
    this.shockwaveRadius = 0.01;
    this.isShockwaveActive = true;
    this.shockwavePos = [0.5, 0.5];
  }

  public getFps(): number {
    return this.fps;
  }

  public getRenderResolution(): { width: number; height: number; scale: number } {
    return {
      width: this.renderWidth,
      height: this.renderHeight,
      scale: this.qualityScale,
    };
  }

  public render(
    video: HTMLVideoElement,
    settings: EffectSettings,
    now: number,
    dynamicBurst: number = 0.0
  ): void {
    const gl = this.gl;
    if (!this.feedbackProgram || !this.compositeProgram || !this.fbos || !this.fboTextures) return;

    // FPS & Auto Quality Calculation
    const delta = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    if (delta > 0) {
      const currentFps = 1 / delta;
      this.fps = Math.round(this.fps * 0.9 + currentFps * 0.1);
    }

    if (settings.quality === 'auto') {
      if (this.fps < 26) {
        this.lowFpsCounter++;
        this.highFpsCounter = 0;
        if (this.lowFpsCounter > 40) {
          if (this.autoQualityLevel === 'high') {
            this.autoQualityLevel = 'med';
            this.setQuality('auto');
          } else if (this.autoQualityLevel === 'med') {
            this.autoQualityLevel = 'low';
            this.setQuality('auto');
          }
          this.lowFpsCounter = 0;
        }
      } else if (this.fps > 55) {
        this.highFpsCounter++;
        this.lowFpsCounter = 0;
        if (this.highFpsCounter > 120) {
          if (this.autoQualityLevel === 'low') {
            this.autoQualityLevel = 'med';
            this.setQuality('auto');
          } else if (this.autoQualityLevel === 'med') {
            this.autoQualityLevel = 'high';
            this.setQuality('auto');
          }
          this.highFpsCounter = 0;
        }
      }
    }

    // Update Shockwave animation
    if (this.isShockwaveActive) {
      this.shockwaveRadius += delta * 2.6;
      if (this.shockwaveRadius > 1.6) {
        this.shockwaveRadius = 0.0;
        this.isShockwaveActive = false;
      }
    }

    // Effective intensity combines master intensity + dynamic burst (from audio or motion)
    const effectiveIntensity = Math.min(1.0, settings.masterIntensity + dynamicBurst);

    // Upload current webcam video frame
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    // Setup Quad geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);

    // -------------------------------------------------------------
    // PASS 1: Feedback Loop (Update ghost trail accumulation buffer)
    // -------------------------------------------------------------
    const readIndex = this.currentFboIndex;
    const writeIndex = 1 - this.currentFboIndex;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[writeIndex]);
    gl.viewport(0, 0, this.renderWidth, this.renderHeight);
    gl.useProgram(this.feedbackProgram);

    const fPosLoc = gl.getAttribLocation(this.feedbackProgram, 'a_position');
    gl.enableVertexAttribArray(fPosLoc);
    gl.vertexAttribPointer(fPosLoc, 2, gl.FLOAT, false, 0, 0);

    // Texture Unit 0: Current Video
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.uniform1i(this.feedbackUniforms['u_currentFrame'], 0);

    // Texture Unit 1: Previous Video
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.prevVideoTexture);
    gl.uniform1i(this.feedbackUniforms['u_prevFrame'], 1);

    // Texture Unit 2: Previous Ghost Feedback
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTextures[readIndex]);
    gl.uniform1i(this.feedbackUniforms['u_feedback'], 2);

    // Texture Unit 3: Mask
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.uniform1i(this.feedbackUniforms['u_mask'], 3);

    // Pass Feedback Uniforms
    gl.uniform1f(this.feedbackUniforms['u_useMask'], settings.useSegmentation ? 1.0 : 0.0);
    gl.uniform1f(this.feedbackUniforms['u_persistence'], settings.trailPersistence);
    gl.uniform1f(this.feedbackUniforms['u_decay'], settings.trailDecay);
    gl.uniform1f(this.feedbackUniforms['u_intensity'], effectiveIntensity);
    gl.uniform1f(this.feedbackUniforms['u_time'], now * 0.001);
    gl.uniform3f(
      this.feedbackUniforms['u_trailColor'],
      settings.trailColor[0],
      settings.trailColor[1],
      settings.trailColor[2]
    );
    gl.uniform1f(this.feedbackUniforms['u_trailLag'], settings.trailLag);
    gl.uniform2f(this.feedbackUniforms['u_resolution'], this.renderWidth, this.renderHeight);
    gl.uniform1f(this.feedbackUniforms['u_mirror'], settings.mirror ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // -------------------------------------------------------------
    // PASS 2: Composite & Glitch (Render to default screen canvas)
    // -------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.renderWidth, this.renderHeight);
    gl.useProgram(this.compositeProgram);

    const cPosLoc = gl.getAttribLocation(this.compositeProgram, 'a_position');
    gl.enableVertexAttribArray(cPosLoc);
    gl.vertexAttribPointer(cPosLoc, 2, gl.FLOAT, false, 0, 0);

    // Texture Unit 0: Video
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.uniform1i(this.compositeUniforms['u_video'], 0);

    // Texture Unit 1: Updated Ghost Feedback (from Pass 1 output)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTextures[writeIndex]);
    gl.uniform1i(this.compositeUniforms['u_feedback'], 1);

    // Texture Unit 2: Mask
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.uniform1i(this.compositeUniforms['u_mask'], 2);

    // Texture Unit 3: Watermark
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.watermarkTexture);
    gl.uniform1i(this.compositeUniforms['u_watermarkTex'], 3);

    // Uniforms
    gl.uniform1f(this.compositeUniforms['u_useMask'], settings.useSegmentation ? 1.0 : 0.0);
    gl.uniform1f(this.compositeUniforms['u_watermark'], settings.watermark ? 1.0 : 0.0);
    gl.uniform1f(this.compositeUniforms['u_intensity'], effectiveIntensity);
    gl.uniform1f(this.compositeUniforms['u_time'], now * 0.001);
    gl.uniform1f(this.compositeUniforms['u_rgbSplit'], settings.rgbSplit);
    gl.uniform1f(this.compositeUniforms['u_sliceJitter'], settings.sliceJitter);
    gl.uniform1f(this.compositeUniforms['u_scanlines'], settings.scanlines);
    gl.uniform1f(this.compositeUniforms['u_noise'], settings.noise);
    gl.uniform1f(this.compositeUniforms['u_pixelSort'], settings.pixelSort);
    gl.uniform1f(this.compositeUniforms['u_contrast'], settings.contrast);
    gl.uniform1f(this.compositeUniforms['u_greenGrade'], settings.greenGrade);
    gl.uniform1f(this.compositeUniforms['u_desatBg'], settings.desatBg);
    gl.uniform1f(this.compositeUniforms['u_shockwave'], this.shockwaveRadius);
    gl.uniform2f(
      this.compositeUniforms['u_shockwavePos'],
      this.shockwavePos[0],
      this.shockwavePos[1]
    );
    gl.uniform2f(this.compositeUniforms['u_resolution'], this.renderWidth, this.renderHeight);
    gl.uniform1f(this.compositeUniforms['u_mirror'], settings.mirror ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Copy current video texture into prevVideoTexture for next frame's motion detection
    // Swapping handles this efficiently by re-binding
    gl.bindTexture(gl.TEXTURE_2D, this.prevVideoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    // Advance ping-pong FBO index
    this.currentFboIndex = writeIndex;
    this.frameCount++;
  }
}
