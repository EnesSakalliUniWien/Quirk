import { Checkbox } from "@base-ui/react/checkbox";

import { LAYERS } from "./analyzerModel.js";
import { ControlRow } from "./control-row.jsx";

/**
 * @typedef {object} LayerSwitchesProps
 * @property {import("./analyzerModel.js").Layers} layers Which constructions are drawn.
 * @property {(key: keyof import("./analyzerModel.js").Layers, checked: boolean) => void} onChange
 */

/**
 * One switch per construction the sphere can draw, so a reading shows only what it asks about.
 *
 * @param {LayerSwitchesProps} props
 */
function LayerSwitches({ layers, onChange }) {
  return (
    <>
      <ControlRow label="Show" role="group" ariaLabel="Constructions to draw">
        {LAYERS.map(([key, label]) => (
          <label key={key} className="bloch-layer">
            <Checkbox.Root
              id={`bloch-layer-${key}`}
              className="bloch-check"
              checked={layers[key]}
              aria-describedby={key === "trig" ? "bloch-trig-help" : undefined}
              onCheckedChange={(checked) => onChange(key, checked)}
            >
              <Checkbox.Indicator className="bloch-check-indicator" />
            </Checkbox.Root>
            {label}
          </label>
        ))}
      </ControlRow>
      <p id="bloch-trig-help" className="bloch-note">
        cos · sin: sphere labels require Components; meridian and equator labels work independently.
      </p>
    </>
  );
}

export { LayerSwitches };
