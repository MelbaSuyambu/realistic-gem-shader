import { gemUniforms } from "../shaders/uniforms.js";

// Keep references to DOM inputs to update them programmatically
const inputs = {};

/**
 * Converts a hex color string (e.g. "#ffffff" or "ffffff") to a normalized [r, g, b] array (0 to 1).
 */
function hexToRgb(hex) {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * Updates all panel UI elements to reflect the current values stored in gemUniforms.
 */
export function updatePanelValues() {
  for (const [key, inputEl] of Object.entries(inputs)) {
    if (!gemUniforms[key]) continue;
    const val = gemUniforms[key].value;
    
    if (inputEl.type === "color") {
      // val is a THREE.Color object
      inputEl.value = "#" + val.getHexString();
    } else if (inputEl.type === "range") {
      inputEl.value = val;
      const valDisplay = inputEl.parentElement.querySelector(".control-value");
      if (valDisplay) {
        const step = inputEl.step || "0.01";
        const decimalPlaces = step.includes(".") ? step.split(".")[1].length : 0;
        valDisplay.textContent = Number(val).toFixed(decimalPlaces);
      }
    }
  }
}

/**
 * Initializes the shader controls in the right panel.
 * @param {Function} onUniformChange - Callback when a control value changes: onUniformChange(key, value)
 */
export function initShaderControls(onUniformChange) {
  const rightPanel = document.getElementById("right-panel");
  if (!rightPanel) {
    console.error("Right panel element (#right-panel) not found in the DOM.");
    return;
  }

  // Remove the placeholder if it exists
  const placeholder = rightPanel.querySelector(".placeholder");
  if (placeholder) {
    placeholder.remove();
  }

  // Clear any previously rendered controls to prevent duplicates
  const existingContainer = rightPanel.querySelector(".controls-container");
  if (existingContainer) {
    existingContainer.remove();
  }

  const container = document.createElement("div");
  container.className = "controls-container";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "8px";

  const controlSections = [
    {
      id: "main",
      title: "MAIN PROPERTIES",
      items: [
        { key: "uGemColor", label: "Gem Color", type: "color" },
        { key: "uIOR", label: "Refractive Index (IOR)", type: "range", min: 1.0, max: 3.0, step: 0.01 },
        { key: "uDispersion", label: "Dispersion Strength", type: "range", min: 0.0, max: 0.5, step: 0.001 },
        { key: "uAbsorptionColor", label: "Absorption Color", type: "color" },
        { key: "uAbsorptionStrength", label: "Absorption Strength", type: "range", min: 0.0, max: 1.0, step: 0.01 },
        { key: "uReflectivity", label: "Reflectivity", type: "range", min: 0.0, max: 1.0, step: 0.01 },
        { key: "uTransmission", label: "Transmission", type: "range", min: 0.0, max: 1.0, step: 0.01 },
        { key: "uEnvIntensity", label: "Environment Intensity", type: "range", min: 0.0, max: 3.0, step: 0.05 }
      ]
    },
    {
      id: "advanced",
      title: "ADVANCED",
      items: [
        { key: "uFresnelPower", label: "Fresnel Power", type: "range", min: 1.0, max: 10.0, step: 0.1 },
        { key: "uNormalSharpness", label: "Normal Sharpness", type: "range", min: 0.0, max: 1.0, step: 0.01 },
        { key: "uRGBBoost", label: "RGB Boost", type: "range", min: 0.5, max: 2.0, step: 0.01 },
        { key: "uEnvSaturation", label: "Env Saturation", type: "range", min: 0.0, max: 1.0, step: 0.01 }
      ]
    }
  ];

  controlSections.forEach(section => {
    const sectionDiv = document.createElement("div");
    sectionDiv.className = "control-section";

    // Collapsible header
    const header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = `<span>${section.title}</span><span class="chevron">▾</span>`;

    // Content area
    const contentDiv = document.createElement("div");
    contentDiv.className = "section-content";

    // Click to toggle expand/collapse
    header.addEventListener("click", () => {
      const isCollapsed = contentDiv.style.display === "none";
      contentDiv.style.display = isCollapsed ? "block" : "none";
      header.querySelector(".chevron").textContent = isCollapsed ? "▾" : "▸";
    });

    section.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "control-row";

      const label = document.createElement("span");
      label.className = "control-label";
      label.textContent = item.label;
      row.appendChild(label);

      let inputEl;
      if (item.type === "color") {
        inputEl = document.createElement("input");
        inputEl.type = "color";

        // Set initial color value
        const initialVal = gemUniforms[item.key]?.value;
        if (initialVal) {
          inputEl.value = "#" + initialVal.getHexString();
        }

        // Handle live updates
        inputEl.addEventListener("input", (e) => {
          const rgb = hexToRgb(e.target.value);
          onUniformChange(item.key, rgb);
        });

        row.appendChild(inputEl);
      } else if (item.type === "range") {
        inputEl = document.createElement("input");
        inputEl.type = "range";
        inputEl.min = item.min;
        inputEl.max = item.max;
        inputEl.step = item.step;

        // Set initial range value
        const initialVal = gemUniforms[item.key]?.value ?? 0;
        inputEl.value = initialVal;

        // Display current value next to slider
        const valDisplay = document.createElement("span");
        valDisplay.className = "control-value";
        const decPlaces = String(item.step).includes(".") ? String(item.step).split(".")[1].length : 0;
        valDisplay.textContent = Number(initialVal).toFixed(decPlaces);

        // Handle live updates
        inputEl.addEventListener("input", (e) => {
          const val = parseFloat(e.target.value);
          valDisplay.textContent = val.toFixed(decPlaces);
          onUniformChange(item.key, val);
        });

        row.appendChild(inputEl);
        row.appendChild(valDisplay);
      }

      if (inputEl) {
        inputs[item.key] = inputEl;
      }
      contentDiv.appendChild(row);
    });

    sectionDiv.appendChild(header);
    sectionDiv.appendChild(contentDiv);
    container.appendChild(sectionDiv);
  });

  // "Reset to Preset" Button
  const resetBtn = document.createElement("button");
  resetBtn.className = "reset-btn";
  resetBtn.textContent = "Reset to Preset";
  resetBtn.addEventListener("click", () => {
    onUniformChange("__reset__", null);
  });

  container.appendChild(resetBtn);
  rightPanel.appendChild(container);
}
