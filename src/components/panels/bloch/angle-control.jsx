import { NumberField } from "@base-ui/react/number-field";
import { Slider } from "@base-ui/react/slider";

/**
 * @typedef {object} AngleControlProps
 * @property {string} id The number field's id.
 * @property {string} symbol The angle's symbol: θ or ϕ.
 * @property {string} name The angle's name, which its slider and its field are both called by.
 * @property {number} value In degrees.
 * @property {boolean} defined Whether the angle exists for the state shown.
 * @property {string=} describedBy The id of the line saying why an angle does not exist.
 * @property {number} max The largest value, in degrees: 180 for θ, 360 for ϕ.
 * @property {(degrees: number) => void} onChange
 */

/**
 * An angle as a slider and a number field kept in step. Where the angle does not exist both are
 * switched off and the field left empty, as the readout's — says, rather than offering a value the
 * state cannot take; the line describedBy names says why. Enter in the field commits it at once,
 * clamped to the angle's range, as leaving the field does.
 *
 * @param {AngleControlProps} props
 */
function AngleControl({ id, symbol, name, value, defined, describedBy, max, onChange }) {
  return (
    <div className="bloch-angle">
      <span className="bloch-angle-symbol" aria-hidden="true">{symbol}</span>
      <Slider.Root
        className="bloch-slider"
        value={value}
        min={0}
        max={max}
        step={0.5}
        disabled={!defined}
        onValueChange={(next) =>
          onChange(Array.isArray(next) ? next[0] : next)
        }
      >
        <Slider.Control className="bloch-slider-control">
          <Slider.Track className="bloch-slider-track">
            <Slider.Indicator className="bloch-slider-indicator" />
            <Slider.Thumb
              className="bloch-slider-thumb"
              aria-label={name}
              aria-describedby={defined ? undefined : describedBy}
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <NumberField.Root
        className="bloch-number"
        value={defined ? Math.round(value * 10) / 10 : null}
        min={0}
        max={max}
        step={0.1}
        disabled={!defined}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <NumberField.Group className="bloch-number-group">
          <NumberField.Input
            id={id}
            className="bloch-number-input"
            aria-label={`${name} in degrees`}
            aria-describedby={defined ? undefined : describedBy}
            onKeyDown={(event) => {
              // Leaving the field is what commits and clamps it; Enter does the same and stays.
              if (event.key !== "Enter") return;
              const input = event.currentTarget;
              input.blur();
              input.focus();
            }}
          />
        </NumberField.Group>
      </NumberField.Root>
      <span className="bloch-angle-unit" aria-hidden="true">°</span>
    </div>
  );
}

export { AngleControl };
