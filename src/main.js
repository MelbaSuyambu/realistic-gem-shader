import "./ui/styles.css";

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

async function switchGem(
  gemData
)
{
  const result =
    await loadGem(
      scene,
      gemData.file
    );

  activeGem =
    result.model;
    setShadowTexture(
  shadowPlane,
  gemData.shadow
);
shadowPlane.scale.set(
  4.5,
  2.5,
  3.5
);
  shadowPlane.position.y =
    -(result.height / 2) - 0.5;
    shadowPlane.position.z = 0;
    shadowPlane.position.x = 0;
}

GEMS.forEach(
  (gem,index)=>
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
    async ()=>{

      document
        .querySelectorAll(
          ".gem-card"
        )
        .forEach(c=>
          c.classList.remove(
            "active"
          )
        );

      card.classList.add(
        "active"
      );

      await switchGem(
        gem
      );

    }
  );

  presetList.appendChild(
    card
  );
});

await switchGem(
  GEMS[0]
);

window.addEventListener(
  "resize",
  ()=>{

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
  requestAnimationFrame(
    animate
  );

  if(activeGem)
{
  activeGem.rotation.y +=
    0.004;

  shadowPlane.rotation.z =
  activeGem.rotation.y - Math.PI;
}

  controls.update();

  renderer.render(
    scene,
    camera
  );
}

animate();