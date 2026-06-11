import * as THREE from "three";

const textureLoader =
  new THREE.TextureLoader();

export function createShadowPlane() {

  const material =
    new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false
    });

  const plane =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        2,
        2
      ),
      material
    );

  plane.rotation.x =
    -Math.PI / 2;

  plane.renderOrder = 1;

  return plane;
}

export function setShadowTexture(
  shadowPlane,
  texturePath
) {
  const texture =
    textureLoader.load(
      texturePath
    );

  shadowPlane.material.map =
    texture;

  shadowPlane.material.needsUpdate =
    true;
}