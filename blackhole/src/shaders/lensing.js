/**
 * 全屏星空引力透镜着色器。
 * 屏幕中心即黑洞投影中心，做极坐标径向位移 r -> r - k/max(r, eps)，
 * 近中心拉伸最强，产生爱因斯坦环与中心视界剪影。
 */

export const starVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

export const starFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  uniform float uK;
  uniform float uRingRadius;
  uniform float uRingWidth;
  uniform float uRingGain;
  uniform vec3 uRingColor;

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float starLayer(vec2 uv, float scale, float threshold, float seed) {
    vec2 grid = uv * scale;
    vec2 id = floor(grid);
    vec2 f = fract(grid) - 0.5;

    float h = hash21(id + seed);
    vec2 offset = vec2(hash21(id + seed + 11.7), hash21(id + seed + 27.3)) - 0.5;
    float d = length(f - offset * 0.62);

    float core = 1.0 - smoothstep(0.0, 0.055, d);
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.8 + h * 2.6) + h * 39.0);
    return core * step(threshold, h) * twinkle;
  }

  float starField(vec2 uv) {
    float s1 = starLayer(uv, 16.0, 0.950, 0.0);
    float s2 = starLayer(uv + 0.13, 33.0, 0.970, 17.0) * 0.7;
    float s3 = starLayer(uv * 0.73 + 0.41, 61.0, 0.985, 53.0) * 0.5;
    return s1 + s2 + s3;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
    float r = length(p);
    vec2 dir = p / max(r, 1e-4);

    // 极坐标径向透镜位移
    float warpedR = max(r - uK / max(r, 0.055), 0.0);
    vec2 warped = dir * warpedR;
    vec2 uvWarped = 0.5 + warped / vec2(uAspect, 1.0);

    // R/B 通道轻微偏移，制造星点色差
    float chroma = 0.0004 + uK * 0.005;
    float iR = starField(uvWarped + vec2(chroma, 0.0));
    float iG = starField(uvWarped);
    float iB = starField(uvWarped - vec2(chroma, 0.0));

    vec3 color = vec3(iR * 0.82, iG * 0.90, iB * 1.05);

    // 深空底雾
    color += vec3(0.004, 0.006, 0.014);

    // 中心视界剪影
    float silhouette = smoothstep(0.025, 0.085, r);
    color *= silhouette;

    // 爱因斯坦环提亮
    float ring = exp(-pow((r - uRingRadius) / max(uRingWidth, 1e-4), 2.0));
    color += uRingColor * ring * uRingGain;

    gl_FragColor = vec4(color, 1.0);
  }
`;
