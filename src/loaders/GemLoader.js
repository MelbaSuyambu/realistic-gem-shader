import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createGemMaterial, clearShaderRegistry } from "../shaders/gemShader.js";

const loader = new GLTFLoader();
let currentGem = null;

export async function loadGem(scene, file, gemId, useCustomShader = true) {

  if (currentGem) {
    scene.remove(currentGem);
  }

  clearShaderRegistry();

  const gltf = await loader.loadAsync(file);
  const model = gltf.scene;
  model.rotation.x = Math.PI / 2;

  const box  = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxAxis    = Math.max(size.x, size.y, size.z);
  const targetSize = 2.0;
  const scale      = targetSize / maxAxis;
  model.scale.setScalar(scale);

  const standardMat = useCustomShader ? null : new THREE.MeshPhysicalMaterial({
    color: 0xaaaaaa,
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.95,
    ior: 2.42,
    thickness: 1.0,
    transparent: true,
    envMap: scene.environment,
    envMapIntensity: 1.5,
  });

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow    = true;
      child.receiveShadow = false;

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      
      const gemMaterial = createGemMaterial(scene, gemId);
      child.userData.customMaterial = gemMaterial;
      child.material = useCustomShader ? gemMaterial : standardMat;
    }
  });

  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);
  currentGem = pivot;

  return {
    model:  pivot,
    height: size.y * scale,
  };
}