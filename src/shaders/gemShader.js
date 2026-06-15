/**
 * gemShader.js  — src/shaders/gemShader.js
 * ══════════════════════════════════════════
 * Person 2 — Shader Engineer
 *
 * Exports:
 *   createGemMaterial()   → GemLoader.js calls this, attaches to each mesh child
 *   applyPreset(gemId)    → PresetPanel.js calls this on gem card click
 *   gemUniforms           → PresetPanel.js reads these to build sliders
 *
 * TECHNIQUE: MeshPhysicalMaterial + onBeforeCompile
 * ─────────────────────────────────────────────────
 * RendererManager already sets:
 *   - ACESFilmicToneMapping
 *   - SRGBColorSpace
 * So we MUST NOT apply manual gamma/tonemapping in GLSL — renderer handles it.
 *
 * EnvironmentLoader sets scene.environment as an equirectangular HDR texture.
 * Three.js converts this internally to a cube map for envMap lookups, so
 * ENVMAP_TYPE_CUBE is defined in the compiled shader and textureCube() works.
 */

import * as THREE from "three";
import { gemUniforms } from "./uniforms.js";
import { GEMS } from "../presets/gemDefinitions.js";

// ─────────────────────────────────────────────────────────────────────────────
// GLSL CHUNKS
// ─────────────────────────────────────────────────────────────────────────────

// Added to vertex shader — passes world-space data to fragment stage
const VERT_PARS = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
`;

const VERT_MAIN_END = /* glsl */`
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vWorldNormal   = normalize(mat3(modelMatrix) * normal);
`;

// Uniform declarations injected at top of fragment shader
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

// Helper functions — injected before void main()
const FRAG_HELPERS = /* glsl */`
  /**
   * Fresnel (Schlick approximation)
   * Returns 0.0 at head-on view (gem center) → 1.0 at grazing angle (gem edges)
   * This makes gem edges brightly reflective — the classic "rim" look.
   */
  float schlickFresnel(vec3 viewDir, vec3 normal, float power) {
    float cosTheta = clamp(dot(viewDir, normal), 0.0, 1.0);
    // Derive F0 from IOR (how much reflects dead-on; diamond ~0.17, glass ~0.04)
    float ior = 1.0 / uRefractionRatio;
    float f0r  = (1.0 - ior) / (1.0 + ior);
    float F0   = f0r * f0r;
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, power);
  }

  /**
   * Beer-Lambert absorption
   * Light loses specific colour channels the deeper it travels through the gem.
   * Ruby absorbs green+blue → red survives. Emerald absorbs red+blue → green.
   *
   * Formula: T = exp(-absorption * strength * depth)
   */
  vec3 beerLambert(vec3 absorptionColor, float strength, float depth) {
    return exp(-absorptionColor * strength * depth * 10.0);
  }

  /**
   * RGB Dispersion — the "fire" rainbow effect in diamonds
   * Different wavelengths (R/G/B) refract at slightly different angles.
   * We sample the env map 3x with offset IOR per channel to fake this.
   */
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

// Core gem shading — injected just BEFORE #include <output_fragment>
// At this point in Three.js's shader, `outgoingLight` holds the PBR result.
// We override it with our gem calculation.
const FRAG_GEM_LOGIC = /* glsl */`
  // ── 1. Directions ───────────────────────────────────────────────────────
  vec3 viewDir  = normalize(cameraPosition - vWorldPosition);
  vec3 N        = normalize(vWorldNormal);
  vec3 incident = -viewDir;

  // ── 2. Facet edge sharpening ────────────────────────────────────────────
  // Use screen-space derivatives to get the flat geometric normal per triangle.
  // Blending toward it makes crystal facet edges crisp rather than smooth.
  vec3 flatN = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
  N = normalize(mix(N, flatN, clamp(uNormalSharpness, 0.0, 1.0)));

  // ── 3. Fresnel weight ───────────────────────────────────────────────────
  float fresnel = clamp(schlickFresnel(viewDir, N, uFresnelPower), 0.0, 1.0);

  // ── 4. Reflection (mirror bounce off gem surface) ───────────────────────
  vec3 reflectDir = reflect(incident, N);
  vec3 reflectedColor = vec3(0.0);
  #ifdef ENVMAP_TYPE_CUBE
    reflectedColor = textureCube(envMap, vec3(-reflectDir.x, reflectDir.yz)).rgb;
  #endif
  reflectedColor *= uEnvIntensity;

  // ── 5. Refraction + Dispersion (light bending + rainbow split) ──────────
  vec3 refractedColor = dispersionRefraction(incident, N);
  refractedColor *= uEnvIntensity;

  // ── 6. Beer-Lambert absorption (colour lost through gem depth) ──────────
  // Path length proxy: steeper viewing angle = longer path through gem
  float pathDepth = 1.0 - clamp(dot(N, viewDir), 0.0, 1.0);
  vec3 transmittance = beerLambert(uAbsorptionColor, uAbsorptionStrength, pathDepth);
  refractedColor *= transmittance;

  // ── 7. Mix reflection + refraction via Fresnel ──────────────────────────
  // Edges (fresnel→1) → reflective | Center (fresnel→0) → transmissive
  vec3 gemColor = mix(refractedColor, reflectedColor, fresnel * uReflectivity);

  // ── 8. Gem base colour tint ─────────────────────────────────────────────
  gemColor *= uGemColor;

  // ── 9. Subtle saturation boost for sparkle ──────────────────────────────
  float lum = dot(gemColor, vec3(0.299, 0.587, 0.114));
  gemColor  = mix(vec3(lum), gemColor, uRGBBoost);

  // ── 10. Blend over Three.js PBR output ─────────────────────────────────
  // outgoingLight = Three.js's computed PBR diffuse+specular lighting.
  // uTransmission controls how strongly our glass-gem effect dominates.
  outgoingLight = mix(outgoingLight, gemColor, uTransmission);

  // Renderer handles ACESFilmic tonemapping + sRGB conversion after this.
`;

// ─────────────────────────────────────────────────────────────────────────────
// createGemMaterial()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the custom gem material.
 *
 * Called in GemLoader.js inside the model.traverse() loop:
 *
 *   import { createGemMaterial } from '../shaders/gemShader.js';
 *
 *   model.traverse((child) => {
 *     if (child.isMesh) {
 *       child.material = createGemMaterial();
 *     }
 *   });
 *
 * @returns {THREE.MeshPhysicalMaterial} patched with gem shader
 */
export function createGemMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    color:           new THREE.Color(1, 1, 1),
    metalness:       0.0,
    roughness:       0.0,
    transmission:    0.95,
    ior:             2.42,
    reflectivity:    0.95,
    envMapIntensity: 1.2,
    transparent:     true,
    side:            THREE.DoubleSide,
    depthWrite:      false,
  });

  material.onBeforeCompile = (shader) => {
    // Attach all uniforms from the shared contract
    Object.assign(shader.uniforms, gemUniforms);

    // ── Vertex shader patches ──────────────────────────────────────────────
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>\n${VERT_PARS}`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>\n${VERT_MAIN_END}`
    );

    // ── Fragment shader patches ────────────────────────────────────────────
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

    // Store so live uniform changes work (uniforms are already reactive,
    // but having _shaderRef available is useful for debugging)
    material.userData.shader = shader;
  };

  material.customProgramCacheKey = () => "gem-shader-v1";

  return material;
}

// ─────────────────────────────────────────────────────────────────────────────
// applyPreset()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a gem's shader preset by ID.
 * Reads from the `shader` block added to gemDefinitions.js.
 *
 * Called in PresetPanel.js (Person 3):
 *   import { applyPreset } from '../shaders/gemShader.js';
 *   applyPreset('ruby');
 *
 * @param {string} gemId  — must match an id in gemDefinitions.js
 */
export function applyPreset(gemId) {
  const gem = GEMS.find((g) => g.id === gemId);
  if (!gem || !gem.shader) {
    console.warn(`[gemShader] No shader preset for: "${gemId}"`);
    return;
  }

  const p = gem.shader;

  // IOR + derived ratio
  if (p.uIOR !== undefined) {
    gemUniforms.uIOR.value             = p.uIOR;
    gemUniforms.uRefractionRatio.value = 1.0 / p.uIOR;
  }

  // All other uniforms
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

// Re-export so Person 3 only needs ONE import source
export { gemUniforms } from "./uniforms.js";
