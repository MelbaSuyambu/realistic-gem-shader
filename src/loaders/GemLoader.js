/**
 * GemLoader.js  — src/loaders/GemLoader.js
 * ══════════════════════════════════════════
 * MODIFIED by Person 2 — added material assignment inside traverse().
 *
 * Person 1 wrote all the load/scale/pivot logic ← UNTOUCHED
 * Person 2 adds: createGemMaterial() call on each mesh child
 *                applyPreset() call to set correct uniforms for current gem
 *
 * Changes are clearly marked with "── PERSON 2 ADDITION ──" comments.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ── PERSON 2 ADDITION ── import shader functions
import { createGemMaterial, applyPreset } from "../shaders/gemShader.js";

const loader = new GLTFLoader();

let currentGem = null;

export async function loadGem(scene, file, gemId) {
  //                                      ^^^^^ PERSON 2 ADDITION: gemId param
  //
  // NOTE FOR PERSON 1: The call in main.js needs one extra argument now.
  // Change:  await loadGem(scene, gemData.file)
  // To:      await loadGem(scene, gemData.file, gemData.id)
  //
  // That's the only change needed in main.js.

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

      // ── PERSON 2 ADDITION ─────────────────────────────────────────────
      // Replace the GLB's baked material with our custom gem shader.
      // Each mesh child gets its own material instance so Three.js can
      // compile the shader correctly per object.
      child.material = createGemMaterial();
      // ─────────────────────────────────────────────────────────────────
    }
  });

  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);
  currentGem = pivot;

  // ── PERSON 2 ADDITION ───────────────────────────────────────────────────
  // After loading, push the correct preset uniforms for this gem.
  // This sets the right colour, IOR, dispersion etc. for diamond vs ruby etc.
  if (gemId) {
    applyPreset(gemId);
  }
  // ────────────────────────────────────────────────────────────────────────

  return {
    model:  pivot,
    height: size.y * scale,
  };
}
