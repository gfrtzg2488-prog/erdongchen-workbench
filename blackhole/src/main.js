import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { EffectComposer } from 'three/addons/EffectComposer.js';
import { RenderPass } from 'three/addons/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/OutputPass.js';

import { CONFIG, IS_MOBILE } from './config.js';
import { AccretionDisk } from './physics.js';
import { createAccretionParticles } from './particles.js';
import { starVertexShader, starFragmentShader } from './shaders/lensing.js';
import { ringVertexShader, ringFragmentShader } from './shaders/particle.js';
import { buildUI } from './ui.js';

const RING_SIZE = 6;

function start() {
  const canvas = document.getElementById('scene');
  const width = window.innerWidth;
  const height = window.innerHeight;

  const maxPixelRatio = IS_MOBILE
    ? CONFIG.render.maxPixelRatio.mobile
    : CONFIG.render.maxPixelRatio.desktop;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);

  // ---------- 渲染器 ----------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.render.exposure;
  renderer.setClearColor(CONFIG.render.background, 1);
  renderer.info.autoReset = false;

  // ---------- 场景与相机 ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.render.background);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    width / height,
    CONFIG.camera.near,
    CONFIG.camera.far
  );
  camera.position.set(...CONFIG.camera.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = CONFIG.camera.minDistance;
  controls.maxDistance = CONFIG.camera.maxDistance;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  controls.update();

  // ---------- 1. 全屏星空透镜（最先绘制）----------
  const starUniforms = {
    uTime: { value: 0 },
    uAspect: { value: width / height },
    uK: { value: CONFIG.lensing.kPerMass * CONFIG.mass.default },
    uRingRadius: { value: CONFIG.lensing.ringRadius },
    uRingWidth: { value: CONFIG.lensing.ringWidth },
    uRingGain: { value: 0.4 },
    uRingColor: { value: new THREE.Color('#9fc4ff') },
  };

  const starfield = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: starUniforms,
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    })
  );
  starfield.frustumCulled = false;
  starfield.renderOrder = -100;
  scene.add(starfield);

  // ---------- 3. 事件视界 + 光子环（先于透明粒子写入深度）----------
  const horizon = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.rs * 1.12, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  horizon.renderOrder = 2;
  scene.add(horizon);

  const ringUniforms = {
    uSize: { value: RING_SIZE },
    uRadius: { value: CONFIG.rs * 1.17 },
    uWidth: { value: 0.055 },
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#ffd9a8') },
  };
  const photonRing = new THREE.Mesh(
    new THREE.PlaneGeometry(RING_SIZE, RING_SIZE),
    new THREE.ShaderMaterial({
      uniforms: ringUniforms,
      vertexShader: ringVertexShader,
      fragmentShader: ringFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    })
  );
  photonRing.renderOrder = 2;
  photonRing.frustumCulled = false;
  scene.add(photonRing);

  // ---------- 2 / 4. 吸积盘粒子（后盘 renderOrder 1，前盘 3）----------
  const disk = new AccretionDisk(CONFIG.particles.max, CONFIG.mass.default);
  const particles = createAccretionParticles(disk, pixelRatio);
  scene.add(particles.backMesh);
  scene.add(particles.frontMesh);

  // ---------- 后期链 ----------
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    IS_MOBILE ? CONFIG.bloom.mobileStrength : CONFIG.bloom.strength,
    CONFIG.bloom.radius,
    CONFIG.bloom.threshold
  );
  const outputPass = new OutputPass();

  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  // ---------- 状态 ----------
  const stats = { frames: 0, fps: 0, particles: 0, physicsMs: 0, calls: 0 };

  const state = {
    mass: CONFIG.mass.default,
    particleCount: IS_MOBILE ? CONFIG.particles.mobile : CONFIG.particles.desktop,
    spin: 1.0,
    bloomStrength: IS_MOBILE ? CONFIG.bloom.mobileStrength : CONFIG.bloom.strength,
    autoRotate: true,
    showStars: true,
  };

  let targetCount = state.particleCount;
  let activeCount = state.particleCount;
  disk.count = activeCount;

  buildUI({
    state,
    stats,
    isMobile: IS_MOBILE,
    physical: () => ({
      rs: CONFIG.rs,
      gm: disk.gm,
      inner: CONFIG.disk.inner,
      outer: CONFIG.disk.outer,
    }),
    actions: {
      setMass(value) {
        disk.setMass(value);
        starUniforms.uK.value = CONFIG.lensing.kPerMass * value;
      },
      setParticleCount(value) {
        targetCount = value;
      },
      setSpin(value) {
        disk.setSpin(value);
      },
      setBloom(value) {
        bloomPass.strength = value;
      },
      setAutoRotate(value) {
        controls.autoRotate = value;
      },
      setStars(value) {
        starfield.visible = value;
      },
    },
  });

  // ---------- 自适应 ----------
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    starUniforms.uAspect.value = w / h;
  });

  // ---------- 主循环 ----------
  let lastTime = performance.now();
  let smoothedPhysics = 0;

  function animate(now) {
    requestAnimationFrame(animate);

    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0), CONFIG.physics.maxDt);

    controls.update(dt);
    camera.updateMatrixWorld();

    // 粒子数量平滑收敛，只改 drawRange / 索引数量，不重建几何体
    if (Math.abs(targetCount - activeCount) < 1) {
      activeCount = targetCount;
    } else {
      activeCount += (targetCount - activeCount) * Math.min(1, dt * 8);
    }
    const count = Math.max(2, Math.round(activeCount));
    disk.count = count;

    const physicsStart = performance.now();
    disk.step(dt);
    disk.partition(camera);
    smoothedPhysics = smoothedPhysics * 0.85 + (performance.now() - physicsStart) * 0.15;

    particles.update(camera);

    starUniforms.uTime.value = now * 0.001;
    ringUniforms.uTime.value = now * 0.001;
    photonRing.quaternion.copy(camera.quaternion);

    renderer.info.reset();
    composer.render();

    stats.frames++;
    stats.particles = count;
    stats.physicsMs = smoothedPhysics;
    stats.calls = renderer.info.render.calls;
  }

  requestAnimationFrame(animate);
}

start();
