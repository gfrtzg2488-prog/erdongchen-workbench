/**
 * 吸积盘粒子着色器 + 事件视界光子环着色器。
 */

export const particleVertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3 uCamPos;

  attribute vec3 aVel;

  varying float vDoppler;
  varying float vRadius;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = clamp(
      uSize * uPixelRatio * 300.0 / max(-mvPosition.z, 0.001),
      1.0,
      9.0
    );

    // 多普勒系数：速度方向与「粒子 -> 相机」方向的夹角余弦
    vec3 toCamera = normalize(uCamPos - position);
    vDoppler = dot(normalize(aVel + vec3(0.0, 0.0, 1e-6)), toCamera);

    // 盘面半径，用于色温渐变
    vRadius = length(position.xz);
  }
`;

export const particleFragmentShader = /* glsl */ `
  uniform vec3 uInnerColor;
  uniform vec3 uMidColor;
  uniform vec3 uOuterColor;
  uniform float uInnerRadius;
  uniform float uOuterRadius;
  uniform float uOpacity;

  varying float vDoppler;
  varying float vRadius;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float alpha = 1.0 - smoothstep(0.08, 0.5, d);
    if (alpha <= 0.002) discard;

    float t = clamp(
      (vRadius - uInnerRadius) / max(uOuterRadius - uInnerRadius, 0.001),
      0.0,
      1.0
    );

    // 内圈白蓝 -> 中段暖白 -> 外圈赭橙
    vec3 color = t < 0.5
      ? mix(uInnerColor, uMidColor, smoothstep(0.0, 0.5, t))
      : mix(uMidColor, uOuterColor, smoothstep(0.5, 1.0, t));

    // 多普勒：迎面（>0）蓝白偏移 + 聚束提亮；远离（<0）暗红
    float blueShift = pow(max(vDoppler, 0.0), 2.0);
    float redShift = pow(max(-vDoppler, 0.0), 2.0);

    color = mix(color, vec3(0.64, 0.80, 1.0), blueShift * 0.85);
    color += vec3(0.45, 0.68, 1.0) * blueShift * 0.85;
    color = mix(color, vec3(0.42, 0.05, 0.02), redShift * 0.72);

    // 留 HDR 余量（可大于 1），交给 Bloom
    float gain = (1.0 + blueShift * 1.15) * (1.0 - redShift * 0.55);
    gl_FragColor = vec4(color * uOpacity * gain, alpha);
  }
`;

/** 光子环：始终朝向相机的平面，加法混合 */
export const ringVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ringFragmentShader = /* glsl */ `
  uniform float uSize;
  uniform float uRadius;
  uniform float uWidth;
  uniform float uTime;
  uniform vec3 uColor;

  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float dist = length(p) * uSize;

    float band = exp(-pow((dist - uRadius) / max(uWidth, 1e-4), 2.0));
    float halo = exp(-pow((dist - uRadius) / (uWidth * 5.0), 2.0)) * 0.12;

    float angle = atan(p.y, p.x);
    float uneven = 0.82 + 0.18 * sin(angle * 5.0 + uTime * 0.9) * cos(angle * 2.0 - uTime * 0.5);

    vec3 color = uColor * (band * 1.0 + halo) * uneven;
    gl_FragColor = vec4(color, 1.0);
  }
`;
