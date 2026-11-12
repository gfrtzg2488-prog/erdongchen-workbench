import { CONFIG, gmForMass } from './config.js';

const TWO_PI = Math.PI * 2;

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
}

/**
 * 粒子状态 + 半隐式欧拉积分 + 重生 + 前后盘索引分区。
 * 所有缓冲区按最大容量一次性预分配，运行期不新建数组。
 */
export class AccretionDisk {
  constructor(capacity, mass = CONFIG.mass.default) {
    this.capacity = capacity;
    this.mass = mass;
    this.gm = gmForMass(mass);
    this.spin = 1.0;
    this.count = capacity;

    this.positions = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);

    this.backIndex = new Uint32Array(capacity);
    this.frontIndex = new Uint32Array(capacity);
    this.backCount = 0;
    this.frontCount = 0;

    this._initAll();
  }

  _initAll() {
    const { initialInner, initialSpan } = CONFIG.disk;
    for (let i = 0; i < this.capacity; i++) {
      this._spawn(i, initialInner, initialInner + initialSpan);
    }
  }

  /** 在 [rMin, rMax] 环带内按随机方位角放置一颗新粒子 */
  _spawn(i, rMin, rMax) {
    const i3 = i * 3;
    const angle = Math.random() * TWO_PI;
    const radius = rMin + Math.random() * (rMax - rMin);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const y = gaussian() * CONFIG.disk.thickness * radius;
    this.positions[i3] = cos * radius;
    this.positions[i3 + 1] = y;
    this.positions[i3 + 2] = sin * radius;

    const vTan = Math.sqrt(this.gm / radius) * this.spin;
    const inflow =
      CONFIG.disk.inflowMin + Math.random() * (CONFIG.disk.inflowMax - CONFIG.disk.inflowMin);
    // 切向 (-sin, 0, cos) + 向内径向 (-cos, 0, -sin) * vTan * inflow
    const vRad = vTan * inflow;
    this.velocities[i3] = -sin * vTan - cos * vRad;
    this.velocities[i3 + 1] = 0;
    this.velocities[i3 + 2] = cos * vTan - sin * vRad;
  }

  /** 半隐式欧拉：v += a*dt，p += v*dt，每帧 substeps 次，dt 上限 1/30 */
  step(dt) {
    const sub = Math.min(dt, CONFIG.physics.maxDt) / CONFIG.physics.substeps;
    const steps = CONFIG.physics.substeps;
    const n = this.count;
    const p = this.positions;
    const v = this.velocities;
    const gm = this.gm;

    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const x = p[i3];
        const y = p[i3 + 1];
        const z = p[i3 + 2];

        const r2 = x * x + y * y + z * z;
        const invR3 = 1 / (Math.sqrt(r2) * r2 + 1e-9);

        v[i3] -= gm * x * invR3 * sub;
        v[i3 + 1] -= gm * y * invR3 * sub;
        v[i3 + 2] -= gm * z * invR3 * sub;

        p[i3] += v[i3] * sub;
        p[i3 + 1] += v[i3 + 1] * sub;
        p[i3 + 2] += v[i3 + 2] * sub;
      }
    }

    // 落入视界或被甩出盘外 → 在盘外缘重生，保持持续内流
    const rIn = CONFIG.rs * 1.12;
    const in2 = rIn * rIn;
    const out2 = CONFIG.disk.escapeRadius * CONFIG.disk.escapeRadius;
    const { respawnInner, respawnOuter } = CONFIG.disk;

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const x = p[i3];
      const y = p[i3 + 1];
      const z = p[i3 + 2];
      const r2 = x * x + y * y + z * z;
      if (r2 < in2 || r2 > out2) {
        this._spawn(i, respawnInner, respawnOuter);
      }
    }
  }

  /** 改变黑洞质量：GM 变化，速度按 sqrt(GM 比例) 缩放以保持轨道形状 */
  setMass(mass) {
    const nextGm = gmForMass(mass);
    const scale = Math.sqrt(nextGm / this.gm);
    const v = this.velocities;
    for (let i = 0; i < this.capacity * 3; i++) v[i] *= scale;
    this.mass = mass;
    this.gm = nextGm;
  }

  /** 改变切向速度系数：只替换切向分量，保留径向内落分量 */
  setSpin(spin) {
    if (spin === this.spin) return;
    this.spin = spin;
    const p = this.positions;
    const v = this.velocities;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const x = p[i3];
      const z = p[i3 + 2];
      const r = Math.sqrt(x * x + z * z) + 1e-6;

      const rx = x / r;
      const rz = z / r;
      const tx = -rz;
      const tz = rx;

      const vRad = v[i3] * rx + v[i3 + 2] * rz;
      const vTarget = Math.sqrt(this.gm / r) * spin;

      v[i3] = rx * vRad + tx * vTarget;
      v[i3 + 2] = rz * vRad + tz * vTarget;
    }
  }

  /**
   * 相机空间深度分区：视空间 viewZ 比球心更小（更远）的粒子归后盘，其余归前盘。
   * 每帧重建两个 Uint32Array 索引，不做 GPU 排序。
   */
  partition(camera) {
    const e = camera.matrixWorldInverse.elements;
    const m2 = e[2];
    const m6 = e[6];
    const m10 = e[10];
    const m14 = e[14]; // 球心（原点）的视空间 z
    const centerZ = m14;

    const p = this.positions;
    const back = this.backIndex;
    const front = this.frontIndex;
    const n = this.count;

    let b = 0;
    let f = 0;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const viewZ = m2 * p[i3] + m6 * p[i3 + 1] + m10 * p[i3 + 2] + m14;
      if (viewZ < centerZ) {
        back[b++] = i;
      } else {
        front[f++] = i;
      }
    }

    this.backCount = b;
    this.frontCount = f;
  }
}
