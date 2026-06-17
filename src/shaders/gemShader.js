/*Person 2 — Shader Engineer*/

import * as THREE from "three";
import { gemUniforms } from "./uniforms.js";
import { GEMS } from "../presets/gemDefinitions.js";

const _compiledShaders = [];
const _activeMaterials = [];

// GLSL CHUNKS

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
    return exp(-absorptionColor * strength * depth * 8.0);
  }

  vec3 sampleEnv(vec3 dir) {
    #ifdef ENVMAP_TYPE_CUBE
      return textureCube(envMap, vec3(-dir.x, dir.yz)).rgb;
    #else
      return vec3(0.9);
    #endif
  }

  float sparklePattern(vec3 dir, vec3 normal, float seed) {
    vec3 h = normalize(dir + normal * seed);
    return pow(max(dot(h, normal), 0.0), 120.0);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
`;

const FRAG_GEM_LOGIC = /* glsl */`
  vec3 viewDir  = normalize(cameraPosition - vWorldPosition);
  vec3 N        = normalize(vWorldNormal);
  vec3 incident = -viewDir;

  // Normals
  vec3 flatN    = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
  vec3 shadingN = normalize(mix(N, flatN, clamp(uNormalSharpness, 0.0, 1.0)));

  // Fresnel 
  float fresnel      = clamp(schlickFresnel(viewDir, shadingN, uFresnelPower), 0.0, 1.0);
  float facetFresnel = clamp(schlickFresnel(viewDir, flatN, uFresnelPower), 0.0, 1.0);
  float edgeMask     = pow(facetFresnel, 2.0);

  // Environment reflection 
  vec3 reflectDir   = reflect(incident, shadingN);
  vec3 reflectedEnv = sampleEnv(reflectDir);

  // Refraction with RGB dispersion split
  float baseIOR = 1.0 / uRefractionRatio;
  vec3 refN = faceforward(shadingN, incident, shadingN);
vec3 refR = refract(incident, refN, 1.0 / (baseIOR + uDispersion * 3.0));
vec3 refG = refract(incident, refN, 1.0 / baseIOR);
vec3 refB = refract(incident, refN, 1.0 / max(baseIOR - uDispersion * 3.0, 0.1));

  // Handle total internal reflection
  if(length(refR) < 0.1) refR = reflectDir;
  if(length(refG) < 0.1) refG = reflectDir;
  if(length(refB) < 0.1) refB = reflectDir;

  vec3 refractedEnv = vec3(
    sampleEnv(refR).r,
    sampleEnv(refG).g,
    sampleEnv(refB).b
  );

  // Beer-Lambert absorption
  float pathDepth     = 1.0 - clamp(dot(shadingN, viewDir), 0.0, 1.0);
  vec3  transmittance = beerLambert(uAbsorptionColor, uAbsorptionStrength, pathDepth);
  refractedEnv       *= transmittance;

  // Procedural internal caustics 
  float s1 = sparklePattern(viewDir, flatN, 1.3);
  float s2 = sparklePattern(viewDir, flatN, 2.7);
  float s3 = sparklePattern(viewDir, -flatN, 0.9);
  float s4 = sparklePattern(viewDir, normalize(flatN + shadingN), 1.8);
  float causticBrightness = s1 + s2 * 0.7 + s3 * 0.5 + s4 * 0.6;

  // Procedural rainbow fire
  float rAngle  = dot(refR, refB);
  float hue     = fract(rAngle * 3.0 + dot(flatN, vec3(0.3, 0.7, 0.2)));
  vec3  fireColor = hsv2rgb(vec3(hue, 1.0, 1.0));
  float fireMask  = causticBrightness * (0.3 + 0.7 * edgeMask) * uDispersion * 15.0;
  vec3  fire      = fireColor * fireMask;

  // Base gem body colour 
  float centerDot  = clamp(dot(shadingN, viewDir), 0.0, 1.0);
  float depthShade = mix(0.08, 0.7, pow(1.0 - centerDot, 1.2));
  float facetAngle  = abs(dot(flatN, viewDir));  // abs() = both front AND back faces
float facetShade  = mix(0.5, 1.0, facetAngle); // higher minimum = no dark patches
vec3  bodyColor   = uGemColor * depthShade * facetShade;

  // Tinted env samples 
  vec3 tintedRefraction = refractedEnv * uGemColor * uEnvIntensity * 2.2;
  vec3 tintedReflection = reflectedEnv * mix(uGemColor * 0.6, vec3(1.0), 0.5) * uEnvIntensity;

  // Combine all layers 
  vec3 gemColor = bodyColor;
  gemColor = mix(gemColor, tintedRefraction, 0.75);
  gemColor = mix(gemColor, tintedReflection, fresnel * uReflectivity * 0.9);
  gemColor += fire;
  gemColor += vec3(pow(causticBrightness, 2.0) * 0.8);
  gemColor += vec3(pow(max(dot(reflectDir, viewDir), 0.0), 64.0) * fresnel * 1.5);

  // Saturation 
  float lum = dot(gemColor, vec3(0.299, 0.587, 0.114));
  gemColor  = mix(vec3(lum), gemColor, uRGBBoost);

  // Reinhard tonemapping — prevents highlights clipping to solid white
  gemColor = gemColor / (gemColor + vec3(1.0));
  gemColor = pow(max(gemColor, 0.0), vec3(0.85));

  gl_FragColor = vec4(gemColor, 1.0);
`;

// createGemMaterial()

export function createGemMaterial(scene, gemId = "diamond") {
  // Bake preset into gemUniforms BEFORE onBeforeCompile fires
  // This fixes the timing issue where some meshes compiled before applyPreset ran
  const gem = GEMS.find(g => g.id === gemId);
  if (gem?.shader) {
    const p = gem.shader;
    if (p.uIOR !== undefined) {
      gemUniforms.uIOR.value             = p.uIOR;
      gemUniforms.uRefractionRatio.value = 1.0 / p.uIOR;
    }
    if (p.uGemColor)        gemUniforms.uGemColor.value.set(...p.uGemColor);
    if (p.uAbsorptionColor) gemUniforms.uAbsorptionColor.value.set(...p.uAbsorptionColor);
    ["uDispersion","uFresnelPower","uAbsorptionStrength","uReflectivity",
     "uTransmission","uEnvIntensity","uNormalSharpness","uRGBBoost"]
      .forEach(k => { if (p[k] !== undefined) gemUniforms[k].value = p[k]; });
  }

  const material = new THREE.MeshPhysicalMaterial({
    color:           new THREE.Color(0, 0, 0),
    metalness:       0.0,
    roughness:       0.0,
    transmission:    0.0,
    ior:             2.42,
    reflectivity:    0.95,
    envMapIntensity: 3.0,
    transparent:     false,
    depthWrite:      true,
    side:            THREE.DoubleSide,
    envMap:          scene ? scene.environment : null,
  });

  material.onBeforeCompile = (shader) => {
    // Give this shader its OWN copy of all uniform values
    // (not a reference to gemUniforms — that's the bug we're fixing)
    shader.uniforms.uGemColor           = gemUniforms.uGemColor;
    shader.uniforms.uIOR                = gemUniforms.uIOR;
    shader.uniforms.uDispersion         = gemUniforms.uDispersion;
    shader.uniforms.uAbsorptionColor    = gemUniforms.uAbsorptionColor;
    shader.uniforms.uAbsorptionStrength = gemUniforms.uAbsorptionStrength;
    shader.uniforms.uReflectivity       = gemUniforms.uReflectivity;
    shader.uniforms.uTransmission       = gemUniforms.uTransmission;
    shader.uniforms.uEnvIntensity       = gemUniforms.uEnvIntensity;
    shader.uniforms.uFresnelPower       = gemUniforms.uFresnelPower;
    shader.uniforms.uNormalSharpness    = gemUniforms.uNormalSharpness;
    shader.uniforms.uRGBBoost           = gemUniforms.uRGBBoost;
    shader.uniforms.uRefractionRatio    = gemUniforms.uRefractionRatio;


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
  "#include <tonemapping_fragment>",
  `${FRAG_GEM_LOGIC}\n#include <tonemapping_fragment>`
);

    material.userData.shader = shader;
  };

  material.customProgramCacheKey = () => "gem-shader-" + Math.random();

  return material;
}


/* applyPreset()
 Pushes new values directly into every compiled shader's uniform object.
 This is the correct way, updating gemUniforms alone does nothing after
 the shader has already compiled.
*/

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
  if (p.uGemColor)        gemUniforms.uGemColor.value.set(...p.uGemColor);
  if (p.uAbsorptionColor) gemUniforms.uAbsorptionColor.value.set(...p.uAbsorptionColor);

  ["uDispersion","uFresnelPower","uAbsorptionStrength",
   "uReflectivity","uTransmission","uEnvIntensity","uNormalSharpness","uRGBBoost"]
    .forEach(k => { if (p[k] !== undefined) gemUniforms[k].value = p[k]; });
}

/* updateUniform()
 For Person 3 (UI sliders) — call this when a slider changes.
 Updates both the shared object AND every live compiled shader.
*/

export function updateUniform(key, val) {
  // Update shared object
  if (Array.isArray(val)) {
    gemUniforms[key].value.set(...val);
  } else {
    gemUniforms[key].value = val;
  }
  if (key === "uIOR") {
    gemUniforms.uRefractionRatio.value = 1.0 / val;
  }

  // Push to all live shaders
  _compiledShaders.forEach((shader) => {
    if (!shader.uniforms[key]) return;
    if (Array.isArray(val)) {
      shader.uniforms[key].value.set(...val);
    } else {
      shader.uniforms[key].value = val;
    }
    if (key === "uIOR") {
      shader.uniforms.uRefractionRatio.value = 1.0 / val;
    }
  });
}

// Clear compiled shader list when a new gem loads (old shaders are gone)
export function clearShaderRegistry() {
  _compiledShaders.length = 0;
  _activeMaterials.length = 0;
}

export { gemUniforms } from "./uniforms.js";