import { AXES } from "./analyzerModel.js";
import { ControlRow } from "./control-row.jsx";

/**
 * @typedef {object} AxisKeyProps
 * @property {string | undefined} pinnedAxis The axis held in focus, if any.
 * @property {(axis: string) => void} onTogglePin Holds an axis, or lets go of the one held.
 * @property {(axis: string | undefined) => void} onPreview Previews an axis while it is hovered
 *     or focused, and ends the preview with undefined.
 */

/**
 * The colour key, which doubles as the control for reading one axis at a time: hovering an axis
 * fades the others, clicking keeps it that way.
 *
 * @param {AxisKeyProps} props
 */
function AxisKey({ pinnedAxis, onTogglePin, onPreview }) {
  return (
    <ControlRow label="Axes">
      <ul className="bloch-legend" aria-label="Axis colours">
        {AXES.map(([axis, kets]) => (
          <li key={axis}>
            <button
              type="button"
              id={`bloch-axis-${axis}-button`}
              className={`bloch-legend-axis bloch-axis-${axis}`}
              aria-pressed={pinnedAxis === axis}
              title={`Read the ${axis} axis on its own`}
              onClick={() => onTogglePin(axis)}
              onPointerEnter={() => onPreview(axis)}
              onPointerLeave={() => onPreview(undefined)}
              onFocus={() => onPreview(axis)}
              onBlur={() => onPreview(undefined)}
            >
              <span className="bloch-swatch" aria-hidden="true" />
              {axis}
            </button>
            <span className="bloch-legend-kets">{kets}</span>
          </li>
        ))}
      </ul>
    </ControlRow>
  );
}

export { AxisKey };
