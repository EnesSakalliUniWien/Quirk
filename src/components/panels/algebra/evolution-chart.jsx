import { useEffect, useMemo, useRef } from "react";
import { bin } from "../../../base/Format.js";
import { Matrix } from "../../../engine/math/matrix/Matrix.js";
import { DataView } from "../../math/data-view.jsx";
import { useWheelScrollsSideways } from "./useWheelScrollsSideways.js";

/** The evolution chart is at most this tall; past it basis states share rows of pixels. */
const EVOLUTION_MAX_HEIGHT = 256;

/** A step's column width once rows share pixels, so a tall, thin chart stays readable. */
const EVOLUTION_PIXEL_COLUMN = 16;

/** How wide the ket labels beside the evolution chart are, in pixels; matches the stylesheet. */
const EVOLUTION_LABEL_WIDTH = 48;

/**
 * Scrolls a horizontal scroller so the span [left, left + width) sits in its middle. Only that one
 * scroller moves: scrollIntoView would also scroll the dock and the page to reach it.
 *
 * @param {!HTMLElement} scroller
 * @param {!number} left
 * @param {!number} width
 */
function centreHorizontally(scroller, left, width) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollTo({
    left: Math.max(0, left - (scroller.clientWidth - width) / 2),
    behavior: reduceMotion ? "auto" : "smooth",
  });
}

/**
 * Every step's state at once, laid out like the circuit: a column per step, left to right, and a
 * row per basis state. It is drawn by the same state renderer as the circuit's amplitude display -
 * discs for magnitude, hands and hue for phase - so it reads the way the canvas does; past
 * EVOLUTION_MAX_HEIGHT rows the renderer switches to pixels, each row of them the largest of the
 * basis states it covers. Reading along a row shows one amplitude change step by step. The current
 * step is outlined and kept in view as the playhead moves.
 *
 * @param {!{states: !Array.<!Matrix>, wireCount: !int, current: !int,
 *     formatKet: (undefined|!function(!int): !string)}} props
 */
function EvolutionChart({ states, wireCount, current, formatKet }) {
  const scrollerRef = useRef(null);
  useWheelScrollsSideways(scrollerRef);
  const size = 1 << wireCount;
  const cell = Math.max(6, Math.min(16, Math.floor(256 / size)));
  const height = Math.min(size * cell, EVOLUTION_MAX_HEIGHT);
  const column = size * cell > EVOLUTION_MAX_HEIGHT ? EVOLUTION_PIXEL_COLUMN : cell;
  const labelled = size <= 16;

  // Column k is the state after step k.
  const evolution = useMemo(() => {
    const steps = states.length;
    const buffer = new Float64Array(size * steps * 2);
    states.forEach((state, k) => {
      const source = state.rawBuffer();
      for (let i = 0; i < size; i++) {
        buffer[(i * steps + k) * 2] = source[i * 2];
        buffer[(i * steps + k) * 2 + 1] = source[i * 2 + 1];
      }
    });
    return new Matrix(steps, size, buffer);
  }, [states, size]);

  // The chart moves with the playhead, the way the step cards below it do.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller !== null) {
      centreHorizontally(scroller, (labelled ? EVOLUTION_LABEL_WIDTH : 0) + current * column, column);
    }
  }, [current, labelled, column]);

  return (
    <div className="algebra-evolution" ref={scrollerRef}>
      <div
        className={labelled ? "evolution-grid evolution-labelled" : "evolution-grid"}
        style={{ "--evolution-cell": `${column}px`, "--evolution-row": `${cell}px` }}
      >
        <ol className="evolution-steps" aria-hidden="true">
          {states.map((_, k) => (
            <li key={k}>{k}</li>
          ))}
        </ol>
        {labelled && (
          <ol className="evolution-kets" aria-hidden="true">
            {Array.from({ length: size }, (_, i) => (
              <li key={i}>{`|${formatKet === undefined ? bin(i, wireCount) : formatKet(i)}⟩`}</li>
            ))}
          </ol>
        )}
        <div className="evolution-plot">
          <DataView
            kind="state"
            data={evolution}
            width={states.length * column}
            height={height}
            options={{ wireCount }}
            label={`How each of the ${size} amplitudes changes over ${states.length - 1} steps`}
          />
          <span
            className="evolution-current"
            aria-hidden="true"
            style={{ left: `${current * column}px`, width: `${column}px` }}
          />
        </div>
      </div>
    </div>
  );
}

export { EvolutionChart };
