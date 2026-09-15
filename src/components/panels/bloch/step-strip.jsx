import { useRef } from "react";

import { STRIP_CELL, STRIP_GAP } from "../../../draw/displays/bloch/BlochStrip.js";
import { FigureHeader } from "./figure-header.jsx";

/**
 * @typedef {object} StepStripProps
 * @property {import("./analyzerModel.js").Step[]} steps The qubit after each column.
 * @property {number | undefined} selected The step being read, ringed on the canvas.
 * @property {import("react").RefObject<HTMLCanvasElement | null>} canvasRef The canvas the steps'
 *     spheres are painted into, all in one so the page keeps few WebGL contexts.
 * @property {(index: number) => void} onSelect
 */

/**
 * The qubit after every column, one small sphere each: a button over each sphere for focus,
 * selection and the arrow keys, which step along the strip and move focus with the selection.
 *
 * @param {StepStripProps} props
 */
function StepStrip({ steps, selected, canvasRef, onSelect }) {
  const buttons = useRef(/** @type {Array<HTMLButtonElement | null>} */ ([]));
  if (steps.length === 0) return null;

  const width = steps.length * (STRIP_CELL + STRIP_GAP) - STRIP_GAP;
  /** @param {import("react").KeyboardEvent} event */
  const onKeyDown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = Math.max(
      0,
      Math.min(
        steps.length - 1,
        (selected ?? 0) + (event.key === "ArrowRight" ? 1 : -1),
      ),
    );
    onSelect(next);
    buttons.current[next]?.focus();
  };

  return (
    <section className="bloch-strip" aria-label="The qubit after each column">
      <FigureHeader title="Steps" caption="← → to step" />
      <div className="bloch-strip-scroll">
        <div
          className="bloch-strip-track"
          style={{ width }}
          role="toolbar"
          aria-label="Circuit steps"
          onKeyDown={onKeyDown}
        >
          <canvas
            id="bloch-strip-canvas"
            ref={canvasRef}
            className="bloch-strip-canvas"
            style={{ width, height: STRIP_CELL }}
            aria-hidden="true"
          />
          {steps.map((step, index) => (
            <button
              key={index}
              type="button"
              ref={(element) => {
                buttons.current[index] = element;
              }}
              className="bloch-strip-step"
              style={{
                left: index * (STRIP_CELL + STRIP_GAP),
                width: STRIP_CELL,
              }}
              aria-pressed={selected === index}
              tabIndex={
                selected === index || (selected === undefined && index === 0)
                  ? 0
                  : -1
              }
              onClick={() => onSelect(index)}
            >
              <span className="bloch-strip-label">{step.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export { StepStrip };
