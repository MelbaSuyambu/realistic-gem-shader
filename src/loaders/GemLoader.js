import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createGemMaterial, clearShaderRegistry } from "../shaders/gemShader.js";

const loader = new GLTFLoader();
let currentGem = null;

export async function loadGem(scene, file, gemId) {

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
      child.material = createGemMaterial(scene, gemId);
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