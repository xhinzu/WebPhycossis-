export const feedbackFragmentShader = `
precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_currentFrame;
uniform sampler2D u_prevFrame;
uniform sampler2D u_feedback;
uniform sampler2D u_mask;
uniform float u_useMask;
uniform float u_persistence;
uniform float u_decay;
uniform float u_intensity;
uniform float u_time;
uniform vec3 u_trailColor;
uniform float u_trailLag;
uniform vec2 u_resolution;
uniform float u_mirror;
uniform float u_flipY;

void main() {
  vec2 uv = v_uv;
  if (u_mirror > 0.5) {
    uv.x = 1.0 - uv.x;
  }

  // Handle WebGL vertical texture flip (camera video and mask)
  vec2 videoUv = uv;
  if (u_flipY > 0.5) {
    videoUv.y = 1.0 - videoUv.y;
  }

  // Sample current and previous video frames
  vec3 currCol = texture2D(u_currentFrame, videoUv).rgb;
  vec3 prevCol = texture2D(u_prevFrame, videoUv).rgb;

  // Calculate temporal motion magnitude
  vec3 diff = currCol - prevCol;
  float motion = length(diff);

  // Person segmentation mask
  float person = 1.0;
  if (u_useMask > 0.5) {
    person = texture2D(u_mask, videoUv).r;
  }

  // Sample previous feedback trails with slight lag offset
  vec2 drift = vec2(sin(u_time * 1.5) * 0.0008, 0.0004) * u_trailLag;
  vec4 prevFeedback = texture2D(u_feedback, v_uv + drift);

  // Apply decay to old ghost trails
  float decayFactor = clamp(u_persistence - u_decay * 0.25, 0.5, 0.985);
  vec3 decayedTrails = prevFeedback.rgb * decayFactor;

  // Calculate new ghost energy from motion & silhouette
  // Higher motion creates stronger neon ghost echo
  float motionGate = smoothstep(0.04, 0.28, motion) * person;
  float ghostEnergy = motionGate * (u_intensity * 1.5 + 0.2);

  // Dynamic color: neon green with cyan/electric lime highlights on high motion
  vec3 neonGreen = u_trailColor;
  vec3 electricCyan = vec3(0.0, 1.0, 0.85);
  vec3 ghostColor = mix(neonGreen, electricCyan, clamp(motion * 3.0, 0.0, 1.0));

  vec3 newGhost = ghostColor * ghostEnergy;

  // Maximum blend to preserve sharp ghost silhouettes, plus subtle additive accumulation
  vec3 combined = max(decayedTrails, newGhost);
  combined = mix(combined, decayedTrails + newGhost * 0.6, 0.35);

  gl_FragColor = vec4(combined, max(prevFeedback.a * decayFactor, motionGate));
}
`;
