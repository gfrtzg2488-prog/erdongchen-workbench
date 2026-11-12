/**
 * 黑洞吸积盘预览 —— 全部物理 / 视觉常量集中于此。
 * 单位：史瓦西半径 rs = 1，场景单位即 rs。
 */
export const CONFIG = {
  rs: 1.0,
  mass: { default: 1.0, min: 0.4, max: 2.5 },
  gmCoefficient: 0.9,

  disk: {
    inner: 2.6,
    outer: 12.0,
    initialInner: 6.5,
    initialSpan: 3.5,
    respawnInner: 9.0,
    respawnOuter: 12.0,
    escapeRadius: 14.0,
    thickness: 0.055,
    inflowMin: 0.02,
    inflowMax: 0.04,
  },

  physics: {
    substeps: 2,
    maxDt: 1 / 30,
  },

  particles: {
    desktop: 12000,
    mobile: 6000,
    min: 2000,
    max: 30000,
    size: 0.11,
    opacity: 0.55,
  },

  bloom: {
    strength: 0.9,
    mobileStrength: 0.55,
    radius: 0.6,
    threshold: 0.15,
  },

  render: {
    exposure: 1.1,
    maxPixelRatio: { desktop: 1.75, mobile: 1.25 },
    background: 0x05060a,
  },

  camera: {
    fov: 45,
    near: 0.1,
    far: 300,
    position: [0, 7.2, 23],
    minDistance: 6,
    maxDistance: 60,
  },

  lensing: {
    kPerMass: 0.018,
    ringRadius: 0.08,
    ringWidth: 0.012,
  },
};

export const IS_MOBILE =
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

/** 引力参数 GM = 0.9 * mass */
export function gmForMass(mass) {
  return CONFIG.gmCoefficient * mass;
}
