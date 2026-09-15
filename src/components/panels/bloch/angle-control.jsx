import { NumberField } from "@base-ui/react/number-field";
import { Slider } from "@base-ui/react/slider";

/**
 * @typedef {object} AngleControlProps
 * @property {string} id The number field's id.
 * @property {string} symbol The angle's name: θ or ϕ.
 * @property {number} value In degrees.
 * @property {boolean} defined Whether the angle exists for the state shown.
 * @property {number} max The largest value, in degrees: 180 for θ, 360 for ϕ.
 * @property {(degrees: number) => void} onChange
 */

/**
 * An angle as a slider and a number field kept in step. Where the angle does not exist the field
 * is left empty, as the readout's — says, rather than showing a zero.
 *
 * @param {AngleControlProps} props
 */
function AngleControl({ id, symbol, value, defined, max, onChange }) {
  return (
    <div className="bloch-angle">
      <span className="bloch-angle-symbol">{symbol}</span>
      <Slider.Root
        className="bloch-slider"
        value={value}
        min={0}
        max={max}
        step={0.5}
        onValueChange={(next) =>
          onChange(Array.isArray(next) ? next[0] : next)
        }
      >
        <Slider.Control className="bloch-slider-control">
          <Slider.Track className="bloch-slider-track">
            <Slider.Indicator className="bloch-slider-indicator" />
            <Slider.Thumb
              className="bloch-slider-thumb"
              aria-label={`${symbol} in degrees`}
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
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <NumberField.Group className="bloch-number-group">
          <NumberField.Input
            id={id}
            className="bloch-number-input"
            aria-label={`${symbol} in degrees`}
          />
        </NumberField.Group>
      </NumberField.Root>
      <span className="bloch-angle-unit">°</span>
    </div>
  );
}

export { AngleControl };
