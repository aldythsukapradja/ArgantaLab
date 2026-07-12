// ── The shared nebula shader — one per-pixel fragment shader, reused by every
// backdrop on the site (tab shell + flight deck) so the whole product reads as
// ONE elegant background system, not several competing ones. Nothing is ever a
// stretched texture (that's what caused the old pixelation); everything here is
// computed at native resolution with an in-shader dither against banding.
export const NEBULA_VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

export const NEBULA_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime; uniform vec2 uRes; uniform float uDark; uniform vec2 uMouse; uniform float uStars;

  float h21(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(7.3, 3.1); a *= 0.5; }
    return v;
  }
  // one twinkling star layer on a hash grid — crisp at any DPR
  float stars(vec2 uvPx, float cell, float density, float t){
    vec2 p = uvPx / cell;
    vec2 i = floor(p), f = fract(p) - 0.5;
    float rnd = h21(i);
    if (rnd < 1.0 - density) return 0.0;
    vec2 off = (vec2(h21(i + 1.3), h21(i + 2.7)) - 0.5) * 0.6;
    float d = length(f - off);
    float tw = 0.65 + 0.35 * sin(t * (0.6 + rnd * 2.4) + rnd * 40.0);
    return smoothstep(0.09, 0.0, d) * tw;
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    vec2 p = (uv - 0.5) * asp + uMouse * 0.06;
    float t = uTime * 0.018;

    float q = fbm(p * 1.4 + t);
    float r = fbm(p * 1.4 + q * 1.6 - t * 0.7 + vec2(4.7, 9.2));
    float n = fbm(p * 1.5 + r * 1.8);
    float n2 = fbm(p * 2.1 - r * 1.2 + vec2(11.0, 3.0) + t * 0.5);

    // ── DARK: deep space ──
    vec3 dBase = mix(vec3(0.040, 0.038, 0.095), vec3(0.078, 0.070, 0.190), smoothstep(0.0, 1.0, 1.0 - uv.y));
    vec3 violet = vec3(0.545, 0.361, 0.965);
    vec3 cyan   = vec3(0.290, 0.760, 0.965);
    vec3 dark = dBase;
    dark += violet * smoothstep(0.48, 0.92, n)  * 0.230;
    dark += cyan   * smoothstep(0.55, 0.95, n2) * 0.115;
    dark += violet * smoothstep(0.72, 1.00, n * n2 * 2.2) * 0.10;
    float s = (stars(gl_FragCoord.xy, 110.0, 0.10, uTime)
             + stars(gl_FragCoord.xy + 37.0, 55.0, 0.05, uTime * 1.4) * 0.6) * uStars;
    dark += vec3(0.85, 0.89, 1.0) * s * (0.55 + 0.45 * smoothstep(0.3, 0.7, n));
    float vig = smoothstep(1.25, 0.35, length((uv - 0.5) * asp));
    dark *= mix(0.72, 1.0, vig);

    // ── LIGHT: Daybreak wash ──
    vec3 lBase = mix(vec3(0.984, 0.982, 0.998), vec3(0.955, 0.948, 0.988), uv.y);
    float wa = smoothstep(0.9, 0.0, length((uv - vec2(0.78, 0.80)) * asp));
    float wb = smoothstep(1.0, 0.0, length((uv - vec2(0.16, 0.12)) * asp));
    vec3 light = lBase
      - violet * wa * 0.045
      - cyan   * wb * 0.030
      - violet * smoothstep(0.55, 0.95, n) * 0.018;

    vec3 col = mix(light, dark, uDark);
    col += (h21(gl_FragCoord.xy + fract(uTime) * 61.7) - 0.5) * (2.4 / 255.0);
    gl_FragColor = vec4(col, 1.0);
  }
`

export interface NebulaUniforms {
  uTime: { value: number }
  uRes: { value: [number, number] }
  uDark: { value: number }
  uMouse: { value: [number, number] }
  uStars: { value: number }
}
