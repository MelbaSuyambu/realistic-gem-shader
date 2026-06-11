import * as THREE from "three";

export function createLights(scene)
{
  const ambient =
    new THREE.AmbientLight(
      0xffffff,
      1.0
    );

  scene.add(ambient);

  const keyLight =
    new THREE.DirectionalLight(
      0xffffff,
      4
    );

  keyLight.position.set(
    5,
    8,
    5
  );

  keyLight.castShadow = true;

  keyLight.shadow.mapSize.set(
    2048,
    2048
  );

  keyLight.shadow.camera.left = -5;
  keyLight.shadow.camera.right = 5;
  keyLight.shadow.camera.top = 5;
  keyLight.shadow.camera.bottom = -5;

  scene.add(keyLight);

  return {
    ambient,
    keyLight
  };
}