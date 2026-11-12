import GUI from 'lil-gui';
import { CONFIG } from './config.js';

const MILESTONES = [
  { id: 'M1', name: '分层渲染与深度顺序' },
  { id: 'M2', name: '盘粒子物理积分' },
  { id: 'M3', name: '多普勒色温着色' },
  { id: 'M4', name: '星空引力透镜' },
  { id: 'M5', name: 'Bloom 与 ACES 输出' },
  { id: 'M6', name: '交互面板与自适应' },
];

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function buildMilestones() {
  const list = document.getElementById('milestones');
  if (!list) return;
  for (const item of MILESTONES) {
    const li = document.createElement('li');

    const dot = document.createElement('span');
    dot.className = 'dot';

    const code = document.createElement('span');
    code.className = 'mid';
    code.textContent = item.id;

    const label = document.createElement('span');
    label.textContent = item.name;

    li.append(dot, code, label);
    list.appendChild(li);
  }
}

function initPanel(isMobile) {
  const collapseBtn = document.getElementById('panel-collapse');
  const openBtn = document.getElementById('panel-open');

  collapseBtn?.addEventListener('click', () => {
    document.body.classList.add('panel-hidden');
  });
  openBtn?.addEventListener('click', () => {
    document.body.classList.remove('panel-hidden');
  });

  if (isMobile) document.body.classList.add('panel-hidden');
}

function createGui({ state, isMobile, actions }) {
  const gui = new GUI({ title: '吸积盘参数', width: isMobile ? 218 : 268 });

  const style = gui.domElement.style;
  style.position = 'fixed';
  style.top = '16px';
  style.left = '16px';
  style.right = 'auto';
  style.setProperty('--background-color', 'rgba(10, 12, 18, 0.92)');
  style.setProperty('--title-background-color', 'rgba(20, 24, 34, 0.95)');
  style.setProperty('--title-text-color', '#e8e4da');
  style.setProperty('--text-color', '#d5d2ca');
  style.setProperty('--widget-color', 'rgba(255, 255, 255, 0.06)');
  style.setProperty('--hover-color', 'rgba(255, 255, 255, 0.12)');
  style.setProperty('--focus-color', '#e08a4c');
  style.setProperty('--number-color', '#e08a4c');
  style.setProperty('--string-color', '#e08a4c');

  gui
    .add(state, 'mass', CONFIG.mass.min, CONFIG.mass.max, 0.01)
    .name('黑洞质量')
    .onChange((value) => actions.setMass(value));

  gui
    .add(state, 'particleCount', CONFIG.particles.min, CONFIG.particles.max, 500)
    .name('粒子数量')
    .onChange((value) => actions.setParticleCount(value));

  gui
    .add(state, 'spin', 0.2, 2.0, 0.01)
    .name('旋转速度')
    .onChange((value) => actions.setSpin(value));

  gui
    .add(state, 'bloomStrength', 0, 2, 0.01)
    .name('Bloom 强度')
    .onChange((value) => actions.setBloom(value));

  gui.add(state, 'autoRotate').name('自动旋转').onChange((value) => actions.setAutoRotate(value));
  gui.add(state, 'showStars').name('显示星空').onChange((value) => actions.setStars(value));

  if (isMobile) gui.close();
  return gui;
}

function startMetrics({ stats, physical }) {
  let lastFrames = 0;
  let lastTime = performance.now();

  window.setInterval(() => {
    const now = performance.now();
    const elapsed = Math.max((now - lastTime) / 1000, 1e-4);
    const deltaFrames = stats.frames - lastFrames;

    lastFrames = stats.frames;
    lastTime = now;

    const instantFps = deltaFrames / elapsed;
    stats.fps = stats.fps * 0.6 + instantFps * 0.4;

    setText('m-fps', stats.fps.toFixed(0));
    setText('m-particles', stats.particles.toLocaleString('en-US'));
    setText('m-physics', `${stats.physicsMs.toFixed(2)} ms`);
    setText('m-calls', String(stats.calls));

    const info = physical();
    setText('p-rs', info.rs.toFixed(3));
    setText('p-gm', info.gm.toFixed(3));
    setText('p-range', `${info.inner.toFixed(1)} – ${info.outer.toFixed(1)}`);
  }, 250);
}

export function buildUI({ state, stats, isMobile, physical, actions }) {
  buildMilestones();
  initPanel(isMobile);

  const qualityNote = document.getElementById('quality-note');
  if (qualityNote) {
    qualityNote.textContent = isMobile
      ? '移动端为降级画质：粒子 6000 · DPR ≤1.25 · Bloom 0.55'
      : '桌面画质：粒子 12000 · DPR ≤1.75 · Bloom 0.9';
  }

  const gui = createGui({ state, isMobile, actions });
  startMetrics({ stats, physical });
  return gui;
}
