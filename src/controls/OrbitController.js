import { OrbitControls }
from "three/examples/jsm/controls/OrbitControls.js";

export function createOrbitControls(
  camera,
  renderer
) {
  const controls =
    new OrbitControls(
      camera,
      renderer.domElement
    );

  controls.enableDamping = true;

  controls.enablePan = false;

  controls.enableZoom = true;

  controls.target.set(
    0,
    0,
    0
  );

  controls.minDistance = 2.5;
  controls.maxDistance = 8;

  // Allow viewing from below and above
controls.minPolarAngle = 0.1;
controls.maxPolarAngle = Math.PI - 0.1;

  return controls;
}