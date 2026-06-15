import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createGemMaterial, applyPreset } from "../shaders/gemShader.js";

const loader = new GLTFLoader();

let currentGem = null;

//FIX: accept 'scene' so we can pass it to createGemMaterial() for envMap
export async function loadGem(scene, file, gemId) {

  if (currentGem) {
    scene.remove(currentGem);
  }

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
      // Pass scene so material can grab scene.environment as envMap
      child.material = createGemMaterial(scene);
    }
  });

  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);
  currentGem = pivot;

  if (gemId) {
    applyPreset(gemId);
  }

  return {
    model:  pivot,
    height: size.y * scale,
  };
}