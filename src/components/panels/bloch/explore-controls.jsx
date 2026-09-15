import { BLOCH_PRESETS } from "../../../engine/math/bloch.js";
import { Button } from "../../ui/button.jsx";
import { ButtonGroup } from "../../ui/button-group.jsx";
import { AngleControl } from "./angle-control.jsx";
import { ControlRow } from "./control-row.jsx";

/**
 * @typedef {typeof BLOCH_PRESETS[number]} Preset
 *
 * @typedef {object} ExploreControlsProps
 * @property {string | undefined} activePreset The preset being explored, if any.
 * @property {boolean} canReturn Whether there is a circuit state to go back to.
 * @property {(preset: Preset) => void} onPreset
 * @property {() => void} onReturn Shows the circuit's state again.
 * @property {import("./analyzerModel.js").Angles} angles
 * @property {(thetaDegrees: number, phiDegrees: number) => void} onAngles
 */

/** @param {string} name @returns {string} The preset button's id: |−i⟩ becomes bloch-preset-−i. */
const presetId = (name) =>
  `bloch-preset-${name === "Mixed" ? "mixed" : name.replace(/[|⟩]/g, "")}`;

/**
 * The controls that put a free state in the analyzer: the preset poles and centre, and θ and ϕ as
 * sliders. Either leaves the circuit's state; the return button brings it back.
 *
 * @param {ExploreControlsProps} props
 */
function ExploreControls({
  activePreset,
  canReturn,
  onPreset,
  onReturn,
  angles,
  onAngles,
}) {
  return (
    <>
      <ControlRow label="Explore">
        <ButtonGroup className="bloch-presets" aria-label="Preset states">
          {BLOCH_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              id={presetId(preset.name)}
              aria-pressed={activePreset === preset.name}
              onClick={() => onPreset(preset)}
            >
              {preset.name}
            </Button>
          ))}
        </ButtonGroup>
        {canReturn && (
          <Button id="bloch-back-to-circuit" onClick={onReturn}>
            Back to circuit
          </Button>
        )}
      </ControlRow>
      <ControlRow label="Angles">
        <AngleControl
          id="bloch-theta-input"
          symbol="θ"
          max={180}
          value={angles.theta}
          defined={angles.thetaDefined}
          onChange={(theta) => onAngles(theta, angles.phi)}
        />
        <AngleControl
          id="bloch-phi-input"
          symbol="ϕ"
          max={360}
          value={angles.phi}
          defined={angles.phiDefined}
          onChange={(phi) => onAngles(angles.theta, phi)}
        />
      </ControlRow>
    </>
  );
}

export { ExploreControls };
