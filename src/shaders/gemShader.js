/*Person 2 — Shader Engineer*/
import * as THREE from "three";
import { gemUniforms } from "./uniforms.js";
import { GEMS } from "../presets/gemDefinitions.js";

//GLSL CHUNKS

const VERT_PARS = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
`;

const VERT_MAIN_END = /* glsl */`
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vWorldNormal   = normalize(mat3(modelMatrix) * normal);
`;

const FRAG_UNIFORMS = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  uniform vec3  uGemColor;
  uniform float uIOR;
  uniform float uDispersion;
  uniform vec3  uAbsorptionColor;
  uniform float uAbsorptionStrength;
  uniform float uReflectivity;
  uniform float uTransmission;
  uniform float uEnvIntensity;
  uniform float uFresnelPower;
  uniform float uNormalSharpness;
  uniform float uRGBBoost;
  uniform float uRefractionRatio;
`;

const FRAG_HELPERS = /* glsl */`
  float schlickFresnel(vec3 viewDir, vec3 normal, float power) {
    float cosTheta = clamp(dot(viewDir, normal), 0.0, 1.0);
    float ior = 1.0 / uRefractionRatio;
    float f0r = (1.0 - ior) / (1.0 + ior);
    float F0  = f0r * f0r;
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, power);
  }

  vec3 beerLambert(vec3 absorptionColor, float strength, float depth) {
    return exp(-absorptionColor * strength * depth * 10.0);
  }

  vec3 dispersionRefraction(vec3 incident, vec3 normal) {
    float baseIOR = 1.0 / uRefractionRatio;
    float iorR = baseIOR + uDispersion;
    float iorG = baseIOR;
    float iorB = baseIOR - uDispersion;

    vec3 refR = refract(incident, normal, 1.0 / iorR);
    vec3 refG = refract(incident, normal, 1.0 / iorG);
    vec3 refB = refract(incident, normal, 1.0 / iorB);

    #ifdef ENVMAP_TYPE_CUBE
      float r = textureCube(envMap, vec3(-refR.x, refR.yz)).r;
      float g = textureCube(envMap, vec3(-refG.x, refG.yz)).g;
      float b = textureCube(envMap, vec3(-refB.x, refB.yz)).b;
      return vec3(r, g, b);
    #else
      return vec3(0.6);
    #endif
  }
`;

const FRAG_GEM_LOGIC = /* glsl */`
  // ── 1. Directions ───────────────────────────────────────────────────────
  vec3 viewDir  = normalize(cameraPosition - vWorldPosition);
  vec3 N        = normalize(vWorldNormal);
  vec3 incident = -viewDir;

  // ── 2. Facet edge sharpening ────────────────────────────────────────────
  vec3 flatN = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
  N = normalize(mix(N, flatN, clamp(uNormalSharpness, 0.0, 1.0)));

  // ── 3. Fresnel weight ───────────────────────────────────────────────────
  float fresnel = clamp(schlickFresnel(viewDir, N, uFresnelPower), 0.0, 1.0);

  // ── 4. Reflection ───────────────────────────────────────────────────────
  vec3 reflectDir = reflect(incident, N);
  vec3 reflectedColor = vec3(0.0);
  #ifdef ENVMAP_TYPE_CUBE
    reflectedColor = textureCube(envMap, vec3(-reflectDir.x, reflectDir.yz)).rgb;
  #endif
  reflectedColor *= uEnvIntensity;

  // ── 5. Refraction + Dispersion ──────────────────────────────────────────
  vec3 refractedColor = dispersionRefraction(incident, N);
  refractedColor *= uEnvIntensity;

  // ── 6. Beer-Lambert absorption ──────────────────────────────────────────
  float pathDepth = 1.0 - clamp(dot(N, viewDir), 0.0, 1.0);
  vec3 transmittance = beerLambert(uAbsorptionColor, uAbsorptionStrength, pathDepth);
  refractedColor *= transmittance;

  // ── 7. Mix reflection + refraction via Fresnel ──────────────────────────
  vec3 gemColor = mix(refractedColor, reflectedColor, fresnel * uReflectivity);

  // ── 8. Gem base colour tint ─────────────────────────────────────────────
  gemColor *= uGemColor;

  // ── 9. Saturation boost ─────────────────────────────────────────────────
  float lum = dot(gemColor, vec3(0.299, 0.587, 0.114));
  gemColor  = mix(vec3(lum), gemColor, uRGBBoost);

  // ── 10. Blend over Three.js PBR output ─────────────────────────────────
  outgoingLight = mix(outgoingLight, gemColor, uTransmission);
`;

// createGemMaterial()

export function createGemMaterial(scene) {
  const material = new THREE.MeshPhysicalMaterial({
    color:           new THREE.Color(1, 1, 1),
    metalness:       0.0,
    roughness:       0.0,
    transmission:    0.0,
    ior:             2.42,
    reflectivity:    0.95,
    envMapIntensity: 1.2,
    transparent:     false,
    depthWrite:      true,
    side:            THREE.DoubleSide,
    envMap:          scene ? scene.environment : null,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, gemUniforms);

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>\n${VERT_PARS}`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>\n${VERT_MAIN_END}`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n${FRAG_UNIFORMS}`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `${FRAG_HELPERS}\nvoid main() {`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <output_fragment>",
      `${FRAG_GEM_LOGIC}\n#include <output_fragment>`
    );

    material.userData.shader = shader;
  };

  material.customProgramCacheKey = () => "gem-shader-v1";

  return material;
}

//applyPreset()

export function applyPreset(gemId) {
  const gem = GEMS.find((g) => g.id === gemId);
  if (!gem || !gem.shader) {
    console.warn(`[gemShader] No shader preset for: "${gemId}"`);
    return;
  }

  const p = gem.shader;

  if (p.uIOR !== undefined) {
    gemUniforms.uIOR.value             = p.uIOR;
    gemUniforms.uRefractionRatio.value = 1.0 / p.uIOR;
  }

  const colorKeys = ["uGemColor", "uAbsorptionColor"];
  const floatKeys = [
    "uDispersion", "uFresnelPower", "uAbsorptionStrength",
    "uReflectivity", "uTransmission", "uEnvIntensity",
    "uNormalSharpness", "uRGBBoost",
  ];

  colorKeys.forEach((key) => {
    if (p[key] !== undefined) gemUniforms[key].value.set(...p[key]);
  });
  floatKeys.forEach((key) => {
    if (p[key] !== undefined) gemUniforms[key].value = p[key];
  });
}

export { gemUniforms } from "./uniforms.js";