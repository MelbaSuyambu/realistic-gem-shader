/**
 * uniforms.js  — src/shaders/uniforms.js
 * ═══════════════════════════════════════
 * THE UNIFORM CONTRACT FILE (from the project PDF)
 *
 * This is the single source of truth for all shader values.
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  Person 2 (Shader) → defines these                  │
 * │  Person 3 (UI)     → reads & writes .value on these │
 * │  Person 1 (Scene)  → never touches these directly   │
 * └─────────────────────────────────────────────────────┘
 *
 * HOW TO USE (Person 3):
 *   import { gemUniforms } from '../shaders/uniforms.js';
 *   gemUniforms.uIOR.value = 1.77;           // change IOR
 *   gemUniforms.uGemColor.value.set('red');  // change color
 */

import * as THREE from "three";

export const gemUniforms = {
  // ── Main Properties (shown in UI "MAIN PROPERTIES" section) ──────────────

  /** Gem base color tint. White = diamond, red = ruby, etc. */
  uGemColor: { value: new THREE.Color(1.0, 1.0, 1.0) },

  /** Index of Refraction — how much light bends inside the gem.
   *  Diamond=2.42, Ruby=1.77, Emerald=1.58, Sapphire=1.77, Topaz=1.62 */
  uIOR: { value: 2.42 },

  /** How strongly white light splits into R/G/B rainbow colours.
   *  0 = no dispersion, 0.1 = strong fire effect */
  uDispersion: { value: 0.044 },

  /** Which colour gets absorbed as light passes through the gem.
   *  This is the colour that gets EATEN (complement of visible colour) */
  uAbsorptionColor: { value: new THREE.Color(0.05, 0.02, 0.01) },

  /** How strongly that absorption colour is removed. 0=clear, 0.2=deep tint */
  uAbsorptionStrength: { value: 0.015 },

  /** Overall mirror-like reflectivity of the surface. 0=matte, 1=mirror */
  uReflectivity: { value: 0.95 },

  /** How much of the environment light passes through (transmission).
   *  1.0 = fully transparent gem */
  uTransmission: { value: 0.95 },

  /** Multiplier on the HDRI environment map brightness */
  uEnvIntensity: { value: 1.2 },

  // ── Advanced Properties (shown in UI "ADVANCED" section) ─────────────────

  /** How sharply the Fresnel rim effect cuts in.
   *  Low=wide soft rim, High=tight bright rim */
  uFresnelPower: { value: 5.0 },

  /** Surface roughness — 0=perfectly smooth, 0.1=slightly frosted */
  uRoughness: { value: 0.0 },

  /** How strongly flat geometric normals sharpen the facet edges.
   *  0=smooth, 1=sharp crystal facets */
  uNormalSharpness: { value: 0.08 },

  /** Boost overall colour saturation for sparkle. 1.0=normal */
  uRGBBoost: { value: 1.05 },

  // ── Internal (computed, not shown in UI sliders) ──────────────────────────

  /** 1/IOR — precomputed for GLSL refract(). Updated when uIOR changes. */
  uRefractionRatio: { value: 1.0 / 2.42 },
};
