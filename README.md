# ⚡ WebPhycossis // Cyberpsychosis Filter

> Live, hardware-accelerated webcam filter that recreates the iconic **"cyberpsychosis" green ghost glitch** from *Cyberpunk: Edgerunners* (David Martinez's Sandevistan moments: neon-green ghost echoes trailing behind movement, chromatic aberration, horizontal glitch tears, and procedural cybernetic audio).

![WebPhycossis Preview](/preview.jpg)

---

## 🔒 100% On-Device & Client-Side Privacy

**Zero video frames, camera streams, or audio recordings ever leave your machine.**
- All shader computation runs locally via your GPU (**WebGL fragment shaders**).
- Background person segmentation runs on-device via **MediaPipe WebAssembly**.
- Sound effects and audio analysis are generated procedurally using the **Web Audio API**.
- Snapshots and video recordings are encoded and saved entirely in your browser's local memory.
- No cloud backends, no tracking, no third-party CDNs, and zero telemetry.

---

## 🎮 Core Features

### 1. WebGL Ghost Feedback Pipeline
- **Ping-Pong Framebuffer Feedback Loop**: Real-time temporal feedback buffer capturing motion energy and leaving delayed, fading, phosphorescent neon-green body silhouettes trailing behind you.
- **RGB Split / Chromatic Aberration**: Horizontal channel separation that dynamically expands with movement or glitch spikes.
- **Horizontal Slice Displacement & Jitter**: Cyberpunk glitch tears and scanline micro-jitter.
- **Digital Noise & Pixel Sort Streaks**: High-frequency speckle noise and horizontal directional bleed streaks.
- **High-Contrast Green/Cyan Color Grading**: Crushed shadows with hyper-vibrant anime neon-green highlights (`#00ff66`, `#00ff88`).
- **"Sandevistan Activation" Shockwave**: Center-outward radial distortion ring with an electric lime flash and chromatic explosion.

### 2. Audio Interactivity & Procedural Cyber Audio
- **Audio-Reactive Glitch**: Microphone volume (RMS analysis via `AnalyserNode`) dynamically boosts glitch intensity and slice displacement.
- **Scream / Burst Trigger**: Loud sounds or screams trigger an instantaneous Sandevistan glitch burst.
- **Procedural Synthesizer**: No external audio files or copyright issues. Procedurally synthesizes:
  - Sandevistan turbine spool + sub-bass frequency drop.
  - Cybernetic glitch bursts and static clicks.
  - Emergency flatline heartbeat alert.
  - Ambient Sandevistan neural hum.

### 3. Optional Person Segmentation (MediaPipe)
- Optional AI segmentation isolating ghost trails strictly to your body while desaturating or darkening the background into a cyber-noir palette.
- Self-hosted WASM and lightweight float16 model (~249 KB).
- Graceful full-frame fallback if disabled or on slower hardware.

### 4. Presets
- **Early David**: Subtle MK-1 neural drift, gentle green ghosting, low aberration.
- **Sandevistan**: Iconic Edgerunners anime moment. Strong trailing echoes, sharp RGB split, audio reactivity.
- **Full Cyberpsychosis**: Unhinged maximum overload. Violent ghost trail feedback, heavy slice tearing, flatline alarm.
- **Custom**: Fine-tuned parameters automatically persisted in your browser's `localStorage`.

### 5. Recording & Sharing
- **High-Res Snapshot**: Captures PNG directly from the WebGL canvas.
- **Video Recording**: High-bitrate recording (MP4 on Safari/iOS, WebM on Chrome/Firefox) mixing both canvas video and procedural/mic audio into the output stream.
- **Web Share API**: Native mobile sharing directly to messaging and social apps, with automatic download fallback.
- **Cyber Watermark**: Toggleable "⚡ WEBPHYCOSSIS // SANDEVISTAN" HUD badge.

---

## 📦 Asset Size Report (Self-Hosted MediaPipe)

All MediaPipe WASM and model files are completely self-hosted in `/public/mediapipe` (no external CDNs):

| Asset | File | Size | Cache Strategy |
| :--- | :--- | :--- | :--- |
| **Model** | `selfie_segmenter.tflite` | 249.5 KB | `max-age=31536000, immutable` |
| **WASM (SIMD)** | `vision_wasm_internal.wasm` | 13.5 MB | `max-age=31536000, immutable` |
| **WASM (SIMD Module)** | `vision_wasm_module_internal.wasm` | 13.5 MB | `max-age=31536000, immutable` |
| **WASM (Fallback)** | `vision_wasm_nosimd_internal.wasm` | 12.6 MB | `max-age=31536000, immutable` |
| **JS Loaders** | `vision_wasm_*.js` | ~1.0 MB | `max-age=31536000, immutable` |
| **Total on Disk** | Entire `/public/mediapipe` suite | **~40.9 MB** | *Browser downloads only ~13.8 MB once* |

---

## 🚀 Deployment on Vercel

The project is structured for zero-configuration static deployment on Vercel:

1. **Framework Preset**: Vite
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. **Environment Variables**: None required (100% static)
5. **Vercel Config**: `vercel.json` includes:
   - `Permissions-Policy: camera=(self), microphone=(self)`
   - `Content-Type: application/wasm` for `.wasm` files
   - Security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`)
   - `Cache-Control: no-cache` for `index.html`
   - Long-term immutable caching for hashed bundles and MediaPipe assets

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| **Space** | Trigger Sandevistan Burst |
| **R** | Start / Stop Video Recording |
| **S** | Capture Snapshot |
| **H** | Toggle Kiroshi Cyber HUD |
| **M** | Toggle Microphone (Audio Reactivity) |
| **Esc** | Close Drawers & Preview Modals |

---

*License: MIT. WebPhycossis is a non-commercial fan-inspired creative visual project.*
