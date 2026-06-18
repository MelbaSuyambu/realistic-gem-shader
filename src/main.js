import "./ui/styles.css";
import * as THREE from "three";

import { createScene }
from "./core/SceneManager";

import { createCamera }
from "./core/CameraManager";

import { createRenderer }
from "./core/RendererManager";

import { createOrbitControls }
from "./controls/OrbitController";

import { loadEnvironment }
from "./loaders/EnvironmentLoader";

import { createLights }
from "./objects/Lights";

import {
  createShadowPlane,
  setShadowTexture
}
from "./objects/ShadowPlane";

import { loadGem }
from "./loaders/GemLoader";

import { GEMS }
from "./presets/gemDefinitions";

import { initShaderControls, updatePanelValues } from "./ui/PresetPanel.js";
import { updateUniform, createGemMaterial } from "./shaders/gemShader.js";

const viewport =
document.getElementById("viewport");

const presetList =
document.getElementById("preset-list");

const scene =
createScene();

const camera =
createCamera(viewport);

const renderer =
createRenderer(viewport);

const controls =
createOrbitControls(
  camera,
  renderer
);

await loadEnvironment(scene);

createLights(scene);

const shadowPlane =
createShadowPlane();

scene.add(shadowPlane);

let activeGem = null;
let activeGemId = GEMS[0].id;
let useCustomShader = true;
let standardMaterial = null;

async function switchGem(gemData)
{
  standardMaterial = null;
  activeGemId = gemData.id;
  const result = await loadGem(
    scene,
    gemData.file,
    gemData.id,
    useCustomShader
  );

  activeGem = result.model;

  setShadowTexture(
    shadowPlane,
    gemData.shadow
  );

  shadowPlane.scale.set(4.5, 2.5, 3.5);
  shadowPlane.position.y = -(result.height / 2) - 0.5;
  shadowPlane.position.z = 0;
  shadowPlane.position.x = 0;

  updatePanelValues();
}

GEMS.forEach(
  (gem, index) =>
{
  const card =
    document.createElement("div");

  card.className =
    index === 0
      ? "gem-card active"
      : "gem-card";

  card.innerText =
    gem.name;

  card.addEventListener(
    "click",
    async () => {

      document
        .querySelectorAll(".gem-card")
        .forEach(c =>
          c.classList.remove("active")
        );

      card.classList.add("active");

      await switchGem(gem);
    }
  );

  presetList.appendChild(card);
});

// Initialize the shader controls and wire up updates/reset behavior
initShaderControls((key, value) => {
  if (key === "__reset__") {
    const currentGemPreset = GEMS.find(g => g.id === activeGemId);
    if (currentGemPreset && currentGemPreset.shader) {
      Object.entries(currentGemPreset.shader).forEach(([uKey, uVal]) => {
        updateUniform(uKey, uVal);
      });
      updatePanelValues();
    }
  } else {
    updateUniform(key, value);
  }
});

const btnCustom = document.getElementById('btn-custom');
const btnStandard = document.getElementById('btn-standard');

function setShaderMode(custom) {
  useCustomShader = custom;
  btnCustom.classList.toggle('active', custom);
  btnStandard.classList.toggle('active', !custom);

  if (!activeGem) return;

  if (custom) {
    // Restore custom shader material — mesh already has it, just re-assign
    activeGem.traverse((child) => {
      if (child.isMesh && child.userData.customMaterial) {
        child.material = child.userData.customMaterial;
      }
    });
    document.getElementById('right-panel').classList.remove('controls-disabled');
  } else {
    // Build standard material once and cache it
    if (!standardMaterial) {
      standardMaterial = new THREE.MeshPhysicalMaterial({
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
    }
    activeGem.traverse((child) => {
      if (child.isMesh) {
        child.material = standardMaterial;
      }
    });
    document.getElementById('right-panel').classList.add('controls-disabled');
  }
}

btnCustom.addEventListener('click', () => setShaderMode(true));
btnStandard.addEventListener('click', () => setShaderMode(false));

await switchGem(GEMS[0]);

window.addEventListener(
  "resize",
  () => {
    camera.aspect =
      viewport.clientWidth /
      viewport.clientHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      viewport.clientWidth,
      viewport.clientHeight
    );
  }
);

function animate()
{
  requestAnimationFrame(animate);

  if (activeGem) {
    activeGem.rotation.y += 0.004;
    shadowPlane.rotation.z =
      activeGem.rotation.y - Math.PI;
  }

  controls.update();

  renderer.render(scene, camera);
}

animate();