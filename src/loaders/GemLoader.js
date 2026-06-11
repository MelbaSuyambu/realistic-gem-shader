import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

let currentGem = null;

export async function loadGem(scene, file) {
  if (currentGem) {
    scene.remove(currentGem);
  }

  const gltf = await loader.loadAsync(file);

  const model = gltf.scene;
model.rotation.x = Math.PI / 2;
  const box = new THREE.Box3().setFromObject(model);

  const size = box.getSize(new THREE.Vector3());

  const maxAxis = Math.max(
    size.x,
    size.y,
    size.z
  );

  const targetSize = 2.0;

  const scale = targetSize / maxAxis;

  model.scale.setScalar(scale);

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });

  const pivot = new THREE.Group();

  pivot.add(model);

  scene.add(pivot);

  currentGem = pivot;

  return {
    model: pivot,
    height: size.y * scale,
  };
}