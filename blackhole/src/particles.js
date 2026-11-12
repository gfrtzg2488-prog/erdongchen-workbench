import * as THREE from 'three';
import { CONFIG } from './config.js';
import { particleVertexShader, particleFragmentShader } from './shaders/particle.js';

const COLORS = {
  inner: '#cde3ff',
  mid: '#ffe6c2',
  outer: '#d96a32',
};

function createMaterial(depthTest, pixelRatio) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: CONFIG.particles.size },
      uPixelRatio: { value: pixelRatio },
      uCamPos: { value: new THREE.Vector3() },
      uInnerColor: { value: new THREE.Color(COLORS.inner) },
      uMidColor: { value: new THREE.Color(COLORS.mid) },
      uOuterColor: { value: new THREE.Color(COLORS.outer) },
      uInnerRadius: { value: CONFIG.disk.inner },
      uOuterRadius: { value: CONFIG.disk.outer },
      uOpacity: { value: CONFIG.particles.opacity },
    },
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest,
    depthWrite: false,
  });
}

/**
 * 两套索引网格共享同一份 position / aVel BufferAttribute：
 * 后盘（depthTest=false）与前盘（depthTest=true）只靠 index 与 renderOrder 区分。
 */
export function createAccretionParticles(disk, pixelRatio) {
  const positionAttribute = new THREE.BufferAttribute(disk.positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  const velocityAttribute = new THREE.BufferAttribute(disk.velocities, 3);
  velocityAttribute.setUsage(THREE.DynamicDrawUsage);

  const createGeometry = (indexArray) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('aVel', velocityAttribute);

    const indexAttribute = new THREE.BufferAttribute(indexArray, 1);
    indexAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setIndex(indexAttribute);
    geometry.setDrawRange(0, 0);
    return geometry;
  };

  const backGeometry = createGeometry(disk.backIndex);
  const frontGeometry = createGeometry(disk.frontIndex);

  const backMaterial = createMaterial(false, pixelRatio);
  const frontMaterial = createMaterial(true, pixelRatio);

  const backMesh = new THREE.Points(backGeometry, backMaterial);
  backMesh.renderOrder = 1;
  backMesh.frustumCulled = false;

  const frontMesh = new THREE.Points(frontGeometry, frontMaterial);
  frontMesh.renderOrder = 3;
  frontMesh.frustumCulled = false;

  return {
    backMesh,
    frontMesh,

    update(camera) {
      backMaterial.uniforms.uCamPos.value.copy(camera.position);
      frontMaterial.uniforms.uCamPos.value.copy(camera.position);

      positionAttribute.needsUpdate = true;
      velocityAttribute.needsUpdate = true;

      backGeometry.index.needsUpdate = true;
      frontGeometry.index.needsUpdate = true;

      backGeometry.setDrawRange(0, disk.backCount);
      frontGeometry.setDrawRange(0, disk.frontCount);
    },

    setPixelRatio(value) {
      backMaterial.uniforms.uPixelRatio.value = value;
      frontMaterial.uniforms.uPixelRatio.value = value;
    },
  };
}
