/*THE UNIFORM CONTRACT FILE
 This is the single source of truth for all shader values.
 Person 2 (Shader) → defines these                  
 Person 3 (UI)     → reads & writes .value on these 
 Person 1 (Scene)  → never touches these directly   

 *How to use for Person 3:
    import { gemUniforms } from '../shaders/uniforms.js';
    gemUniforms.uIOR.value = 1.77;           // change IOR
    gemUniforms.uGemColor.value.set('red');  // change color
 */

import * as THREE from "three";

export const gemUniforms = {
  uGemColor: { value: new THREE.Color(1.0, 1.0, 1.0) },

  uIOR: { value: 2.42 },

  uDispersion: { value: 0.044 },

  uAbsorptionColor: { value: new THREE.Color(0.05, 0.02, 0.01) },

  uAbsorptionStrength: { value: 0.015 },
  
  uReflectivity: { value: 0.95 },

  uTransmission: { value: 0.95 },

  uEnvIntensity: { value: 1.2 },

  uFresnelPower: { value: 5.0 },

  uRoughness: { value: 0.0 },

  uNormalSharpness: { value: 0.08 },

  uRGBBoost: { value: 1.05 },

  uRefractionRatio: { value: 1.0 / 2.42 },
};
