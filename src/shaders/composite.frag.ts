export const compositeFragmentShader = `
precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_video;
uniform sampler2D u_feedback;
uniform sampler2D u_mask;
uniform sampler2D u_watermarkTex;
uniform float u_useMask;
uniform float u_watermark;
uniform float u_intensity;
uniform float u_time;
uniform float u_rgbSplit;
uniform float u_sliceJitter;
uniform float u_scanlines;
uniform float u_noise;
uniform float u_pixelSort;
uniform float u_contrast;
uniform float u_greenGrade;
uniform float u_desatBg;
uniform float u_shockwave;
uniform vec2 u_shockwavePos;
uniform vec2 u_resolution;
uniform float u_mirror;
uniform float u_flipY;
uniform float u_mode; // 0.0 = MOTION TRAILS, 1.0 = OVERLAY
uniform float u_trailCount; // 1.0 to 6.0
uniform float u_trailSpread; // 0.0 to 1.0
uniform float u_trailBrightness; // 0.5 to 2.5
uniform float u_bgDarken; // 0.0 to 0.6 (default 0.25)
uniform float u_edgeFeather; // 0.01 to 0.20 (default 0.06)
uniform float u_trailOpacity; // 0.2 to 2.0 (default 1.2)
uniform float u_faceProtection; // 1.0 = on, 0.0 = off

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = v_uv;
  vec2 rawUv = v_uv;

  // 1. Shockwave distortion (Sandevistan blast)
  float wave = 0.0;
  if (u_shockwave > 0.0) {
    vec2 toCenter = uv - u_shockwavePos;
    toCenter.x *= (u_resolution.x / u_resolution.y);
    float dist = length(toCenter);
    float diff = dist - u_shockwave;
    wave = smoothstep(0.08, 0.0, abs(diff)) * (1.0 - clamp(u_shockwave / 1.5, 0.0, 1.0));
    uv += normalize(toCenter + 0.0001) * wave * 0.035;
  }

  // UV coordinate for camera feed (handling mirror toggle and vertical flip)
  vec2 videoUv = uv;
  if (u_mirror > 0.5) {
    videoUv.x = 1.0 - videoUv.x;
  }
  if (u_flipY > 0.5) {
    videoUv.y = 1.0 - videoUv.y;
  }

  vec3 col = vec3(0.0);

  if (u_mode < 0.5) {
    // =========================================================================
    // MODE 1: MOTION TRAILS (DEFAULT)
    // 3-LAYER SANDWICH COMPOSITING:
    // Layer 1 (Bottom): Background live frame (darkened/desaturated via slider)
    // Layer 2 (Middle): Glowing neon ghost trails (BEHIND and AROUND subject)
    // Layer 3 (Top):    100% UNTOUCHED, CRYSTAL-CLEAR live person & face
    // =========================================================================
    vec3 liveFrame = texture2D(u_video, videoUv).rgb;

    // 1. Calculate feathered subject mask & face protection safeguard
    float subjectMask = 0.0;
    float rawMask = 0.0;
    vec2 pxStep = vec2(2.5 / u_resolution.x, 2.5 / u_resolution.y);

    if (u_useMask > 0.5) {
      float m0 = texture2D(u_mask, videoUv).r;
      float m1 = texture2D(u_mask, videoUv + vec2(pxStep.x, 0.0)).r;
      float m2 = texture2D(u_mask, videoUv - vec2(pxStep.x, 0.0)).r;
      float m3 = texture2D(u_mask, videoUv + vec2(0.0, pxStep.y)).r;
      float m4 = texture2D(u_mask, videoUv - vec2(0.0, pxStep.y)).r;
      rawMask = m0;
      // Multi-tap minimum erosion (2-4px) completely eliminates green halo/fringe on subject edges
      float erodedMask = min(m0, min(min(m1, m2), min(m3, m4)));
      float feather = clamp(u_edgeFeather, 0.01, 0.20);
      subjectMask = smoothstep(0.48 - feather, 0.52 + feather, erodedMask);
    }

    // Face Protection Safeguard:
    // Screen-space head & face safety zone ensures the face is ALWAYS pure, pristine live frame
    if (u_faceProtection > 0.5) {
      vec2 faceCenter = vec2(0.5, 0.68);
      vec2 faceDist = (uv - faceCenter) / vec2(0.20, 0.26);
      float faceEllipse = 1.0 - smoothstep(0.70, 1.0, length(faceDist));
      if (u_useMask > 0.5) {
        // Enforce face region unconditionally even if segmentation drops confidence on edge
        subjectMask = max(subjectMask, faceEllipse * smoothstep(0.10, 0.30, rawMask));
      } else {
        // Fallback: segmentation unavailable, force central face region 100% clean
        subjectMask = max(subjectMask, faceEllipse);
      }
    }

    // 2. LAYER 1: Background Layer (Live camera frame with darkening/desaturation)
    float bgDarken = clamp(u_bgDarken, 0.0, 0.60);
    vec3 bgLayer = liveFrame * (1.0 - bgDarken);
    float bgLuma = dot(bgLayer, vec3(0.299, 0.587, 0.114));
    bgLayer = mix(bgLayer, vec3(bgLuma * 0.9, bgLuma * 0.95, bgLuma * 1.0), bgDarken * 0.5);

    // 3. LAYER 2: Trail Layer (Multi-tap discrete Sandevistan afterimages)
    vec3 ghostEchoes = vec3(0.0);
    float totalWeight = 0.0;

    for (int i = 0; i < 6; i++) {
      if (float(i) >= u_trailCount) break;
      float fi = float(i);

      vec2 echoOffset = vec2(
        sin(u_time * 2.0 + fi * 1.4) * 0.002,
        -0.004 * (fi + 1.0)
      ) * u_trailSpread;

      vec2 sampleUv = rawUv + echoOffset;
      vec3 tap = texture2D(u_feedback, sampleUv).rgb;

      // Chromatic separation on deeper echo layers (confined inside trail layer)
      if (fi > 0.5 && u_rgbSplit > 0.005) {
        float splitShift = u_rgbSplit * 0.015 * fi;
        float r = texture2D(u_feedback, sampleUv + vec2(splitShift, 0.0)).r;
        float b = texture2D(u_feedback, sampleUv - vec2(splitShift, 0.0)).b;
        tap = vec3(r, tap.g, b);
      }

      float weight = pow(0.72, fi);
      ghostEchoes += tap * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0.0) {
      ghostEchoes = (ghostEchoes / totalWeight) * (u_trailBrightness * (1.1 + u_intensity * 0.7)) * u_trailOpacity;
    }

    // Mask trails OUT from current subject position so trails only emerge BEHIND and AROUND
    // Dilated cutout boundary ensures zero green trails or glow bleed into the subject edge
    float trailCutout = subjectMask;
    if (u_useMask > 0.5) {
      trailCutout = max(trailCutout, smoothstep(0.32, 0.52, rawMask));
    }
    ghostEchoes *= (1.0 - trailCutout);

    // Composite trails onto background (screen blend)
    vec3 bgWithTrails = 1.0 - (1.0 - bgLayer) * (1.0 - clamp(ghostEchoes, 0.0, 1.0));

    // Shockwave flash ring (confined to background/trails, never on face or body)
    bgWithTrails += vec3(0.15, 1.0, 0.55) * wave * 0.85 * (1.0 - subjectMask);

    // 4. LAYER 3: Subject Layer (Always on top, 100% clean live camera frame, no tint, no glitch)
    col = mix(bgWithTrails, liveFrame, subjectMask);

  } else {
    // =========================================================================
    // MODE 2: OVERLAY (Full-frame cyberpsychosis glitch)
    // =========================================================================
    // Horizontal slice displacement (Glitch tears)
    vec2 glitchUv = videoUv;
    float sliceBlock = floor(uv.y * 30.0 + u_time * 6.0);
    float sliceRand = hash(sliceBlock);
    if (sliceRand > 0.82) {
      float shift = (hash(sliceBlock * 2.37) - 0.5) * 0.065 * u_sliceJitter * u_intensity;
      glitchUv.x += shift;
    }
    glitchUv.x += sin(uv.y * 420.0 + u_time * 30.0) * 0.0012 * u_sliceJitter * u_intensity;

    // Chromatic Aberration / RGB Split
    float splitAmt = (u_rgbSplit * 0.035 * u_intensity) + (wave * 0.03);
    vec2 splitOffset = vec2(splitAmt, 0.0);

    float r = texture2D(u_video, glitchUv + splitOffset).r;
    float g = texture2D(u_video, glitchUv).g;
    float b = texture2D(u_video, glitchUv - splitOffset).b;
    col = vec3(r, g, b);

    // Sample accumulated ghost trails from feedback FBO
    vec3 ghostCenter = texture2D(u_feedback, rawUv).rgb;
    vec3 ghostR = texture2D(u_feedback, rawUv + splitOffset * 1.5).rgb;
    vec3 ghostB = texture2D(u_feedback, rawUv - splitOffset * 1.5).rgb;
    vec3 ghostSplit = vec3(ghostR.r * 0.6 + ghostCenter.r * 0.4, ghostCenter.g, ghostB.b * 0.7 + ghostCenter.b * 0.3);

    // Pixel Sort / Directional streak smearing
    if (u_pixelSort > 0.1 && u_intensity > 0.2) {
      vec3 streak = vec3(0.0);
      for (int i = 1; i <= 5; i++) {
        float fi = float(i);
        vec2 sUv = rawUv - vec2(fi * 0.007 * u_pixelSort, 0.0);
        vec3 sampleCol = texture2D(u_feedback, sUv).rgb;
        streak += max(vec3(0.0), sampleCol - 0.3) * (1.0 - fi / 6.0);
      }
      col += streak * 0.45 * u_intensity;
    }

    col += ghostSplit * (1.3 + u_intensity * 0.8);

    // Person Segmentation & Background Desaturation
    if (u_useMask > 0.5) {
      float mask = texture2D(u_mask, videoUv).r;
      float isPerson = smoothstep(0.25, 0.65, mask);
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 cyberBg = mix(col, vec3(luma * 0.35, luma * 0.5, luma * 0.65), u_desatBg * 0.9);
      col = mix(cyberBg, col, isPerson);
    }

    // High-Contrast & Cyberpunk Green/Cyan Grading
    col = (col - 0.5) * u_contrast + 0.5;
    col = clamp(col, 0.0, 1.0);

    vec3 cyberGrade = vec3(
      col.r * 0.78,
      pow(col.g, 0.85) * 1.18,
      col.b * 0.92 + col.g * 0.14
    );
    col = mix(col, cyberGrade, u_greenGrade * (0.6 + u_intensity * 0.4));

    // CRT Scanlines
    float scanline = sin(v_uv.y * u_resolution.y * 1.6 + u_time * 8.0) * 0.5 + 0.5;
    col *= (1.0 - scanline * 0.16 * u_scanlines);

    // Digital speckle noise
    float grain = (hash2(v_uv * 100.0 + fract(u_time * 19.3)) - 0.5) * 0.15 * u_noise * u_intensity;
    col += vec3(grain);

    // Shockwave bright neon flash highlight
    col += vec3(0.15, 1.0, 0.55) * wave * 0.85;
  }

  // Watermark overlay (bottom right)
  if (u_watermark > 0.5) {
    float wmWidth = 240.0 / u_resolution.x;
    float wmHeight = 44.0 / u_resolution.y;
    float wmMarginX = 16.0 / u_resolution.x;
    float wmMarginY = 16.0 / u_resolution.y;

    if (v_uv.x >= (1.0 - wmWidth - wmMarginX) && v_uv.x <= (1.0 - wmMarginX) &&
        v_uv.y >= wmMarginY && v_uv.y <= (wmMarginY + wmHeight)) {
      vec2 wmUv = vec2(
        (v_uv.x - (1.0 - wmWidth - wmMarginX)) / wmWidth,
        1.0 - (v_uv.y - wmMarginY) / wmHeight
      );
      vec4 wmCol = texture2D(u_watermarkTex, wmUv);
      col = mix(col, wmCol.rgb, wmCol.a);
    }
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
