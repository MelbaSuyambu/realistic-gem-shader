import * as THREE from "three";
import { RGBELoader }
from "three/examples/jsm/loaders/RGBELoader.js";

export async function loadEnvironment(
  scene
) {
  const hdr =
    await new RGBELoader()
      .loadAsync("/hdri/studio.hdr");

  hdr.mapping =
    THREE.EquirectangularReflectionMapping;

  scene.environment = hdr;
}