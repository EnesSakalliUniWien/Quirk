import { Tabs } from "@base-ui/react/tabs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import {
  ZERO_PROBABILITY,
  formatProbability,
  probabilityBarFraction,
} from "../../../draw/displays/probability/ProbabilityScale.js";
import { stateAtStep } from "../../../engine/simulation/stepAlgebra.js";
import { appStore } from "../../../state/appStore.js";
import { useWheelScrollsSideways } from "../algebra/useWheelScrollsSideways.js";
import { usePlayheadStats } from "../shared/usePlayheadStats.js";
import { MAX_ROWS, probabilitiesOf, stepStops, stepTables } from "./stepTables.js";

/** Decimals of the exact chance a cell's title gives. */
const EXACT_DIGITS = 4;

/** The two layouts, in the order the tabs offer them. */
const LAYOUTS = /** @type {const} */ ([
  ["index", "Index order"],
  ["grouped", "Grouped by correlated qubits"],
]);

/**
 * @param {number} step
 * @returns {string} "at the start", or "after step 2".
 */
const whenOf = (step) => (step === 0 ? "at the start" : `after step ${step}`);

/**
 * One distribution traced through the circuit, the way a debugger lists a variable at each stop:
 * an outcome per row and a step per column, left to right like the circuit. A column fills in once
 * the playhead has reached its step, so stepping adds one column at a time and every earlier step
 * stays in view to compare against. Each cell is a data bar behind the percentage, every bar in
 * the table on one scale; ▲ and ▼ mark the chances a step raised or lowered, and the ones it left
 * alone step back. The playhead's step is marked and kept in view, and a step's header moves the
 * playhead there.
 *
 * @param {{ table: import("./stepTables.js").StepTable,
 *     stops: import("./stepTables.js").StepStop[], current: number,
 *     onSeek: (column: number) => void }} props
 */
function StepTable({ table, stops, current, onSeek }) {
  const scrollerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  useWheelScrollsSideways(scrollerRef);

  // Show only whole steps beside the kets: the scroller is as wide as the steps that fit, so every
  // scroll position, the last one included, starts on a step's edge.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const figure = scroller?.parentElement;
    if (scroller === null || scroller === undefined || figure === null || figure === undefined) {
      return undefined;
    }
    const fit = () => {
      const kets = scroller.querySelector(".probabilities-corner")?.offsetWidth ?? 0;
      const step = scroller.querySelector("th[data-step]")?.offsetWidth ?? 0;
      if (step > 0) {
        const whole = Math.max(1, Math.floor((figure.clientWidth - kets) / step));
        scroller.style.maxWidth = `${kets + whole * step}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(figure);
    return () => observer.disconnect();
  }, [stops.length, table.rows.length]);

  // Keep the playhead's step in view as it moves - only when it moves, so scrolling back by hand
  // to compare an earlier step is not undone on the next sample. Snapping stops a step's edge just
  // clear of the kets, whose width the scroll padding follows.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const header = scroller?.querySelector(`th[data-step="${current}"]`);
    if (scroller === null || scroller === undefined || header === null || header === undefined) {
      return;
    }
    const kets = scroller.querySelector(".probabilities-corner")?.offsetWidth ?? 0;
    scroller.style.scrollPaddingInlineStart = `${kets}px`;
    const right = header.offsetLeft + header.offsetWidth;
    if (right > scroller.scrollLeft + scroller.clientWidth || header.offsetLeft - kets < scroller.scrollLeft) {
      // The first whole step that still leaves the playhead's step in view starts the scrolled part.
      const first = [...scroller.querySelectorAll("th[data-step]")]
        .find((step) => step.offsetLeft - kets >= right - scroller.clientWidth) ?? header;
      scroller.scrollTo({
        left: Math.max(0, first.offsetLeft - kets),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  }, [current]);

  return (
    <figure className="probabilities-group">
      {table.title !== undefined && (
        <figcaption className="probabilities-group-title">{table.title}</figcaption>
      )}
      <div className="probabilities-trace-scroll" ref={scrollerRef}>
        <table
          className="probabilities-trace"
          aria-label={table.title ?? "Probability of each outcome at each step"}
        >
          <thead>
            <tr>
              <th scope="col" className="probabilities-corner">outcome</th>
              {stops.map((stop, step) => (
                <th
                  key={step}
                  scope="col"
                  data-step={step}
                  data-reached={step <= current}
                  aria-current={step === current ? "step" : undefined}
                >
                  <button
                    type="button"
                    className="probabilities-step-header"
                    title={`${stop.description}. Move the playhead here.`}
                    onClick={() => onSeek(stop.column)}
                  >
                    <span className="probabilities-step-number">{step}</span>
                    <span className="probabilities-step-gates">{stop.label}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.index}>
                <th
                  scope="row"
                  className="probabilities-ket"
                  data-possible={row.values.some((p, step) => step <= current && p > ZERO_PROBABILITY)}
                >
                  {`|${row.ket}⟩`}
                </th>
                {row.values.map((p, step) => {
                  if (step > current) {
                    return <td key={step} data-reached="false" />;
                  }
                  const change = row.changes[step];
                  return (
                    <td
                      key={step}
                      data-reached="true"
                      data-current={step === current}
                      data-possible={p > ZERO_PROBABILITY}
                      data-change={change === undefined ? undefined : change === 0 ? "none" : change > 0 ? "up" : "down"}
                      title={`|${row.ket}⟩ ${whenOf(step)}: ${formatProbability(p, EXACT_DIGITS)}`}
                    >
                      <span
                        className="probabilities-bar"
                        aria-hidden="true"
                        style={{ "--fraction": probabilityBarFraction(p, table.largest) }}
                      />
                      <span className="probabilities-value">{formatProbability(p).replace("%", "")}</span>
                      <span className="probabilities-change">
                        {change === 1 ? "▲" : change === -1 ? "▼" : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.hidden > 0 && (
        <p className="debug-panel-note">
          {`${table.hidden} more outcomes are not shown: they are impossible at every step, or less likely than the ${MAX_ROWS} shown.`}
        </p>
      )}
    </figure>
  );
}

/**
 * Measurement odds traced through the circuit's steps, to follow what each step does while
 * stepping: the state at the start, then after each column that operates, as the transport steps
 * through them. Laid out as one table of every outcome in index order, or as one table per group of
 * qubits correlated at some step, since independent qubits multiply rather than need a joint table.
 */
function ProbabilitiesPanel() {
  const sample = usePlayheadStats();
  const playhead = useStore(appStore, (s) => s.playhead);
  const [layout, setLayout] = useState(/** @type {"index" | "grouped"} */ ("index"));

  const history = useMemo(() => {
    if (sample === undefined) {
      return undefined;
    }
    const { fullStats, wireCount } = sample;
    const circuit = fullStats.circuitDefinition;
    const stops = stepStops(circuit);
    return {
      stops,
      wireCount,
      registers: circuit.registers,
      steps: stops.map(({ column }) => probabilitiesOf(stateAtStep(fullStats, wireCount, column))),
    };
  }, [sample]);
  const tables = useMemo(
    () => (history === undefined ? [] : stepTables(history.steps, layout, history.wireCount, history.registers)),
    [history, layout],
  );

  if (history === undefined) {
    return <p className="debug-panel-empty">Waiting for the circuit…</p>;
  }

  const { stops, steps } = history;
  const current = Math.max(0, stops.findLastIndex((stop) => stop.column <= sample.step));
  const now = steps[current];
  const possible = now.filter((p) => p > ZERO_PROBABILITY).length;
  const largest = now.reduce((most, p) => Math.max(most, p), 0);

  return (
    <section className="debug-panel" aria-labelledby="probabilities-heading">
      <header className="debug-panel-header">
        <h2 id="probabilities-heading" className="debug-panel-heading">
          Measurement probabilities
        </h2>
        <span className="debug-panel-summary">
          {`${possible} of ${now.length} outcomes possible · largest ${formatProbability(largest)}`}
        </span>
      </header>
      <Tabs.Root className="probabilities-layouts" value={layout} onValueChange={setLayout}>
        <Tabs.List className="probabilities-tabs" aria-label="Layout">
          {LAYOUTS.map(([value, label]) => (
            <Tabs.Tab key={value} value={value} id={`probabilities-layout-${value}`}>
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {LAYOUTS.map(([value]) => (
          <Tabs.Panel key={value} value={value} className="probabilities-tab-panel">
            {value === layout &&
              tables.map((table) => (
                <StepTable
                  key={table.key}
                  table={table}
                  stops={stops}
                  current={current}
                  onSeek={(column) => playhead?.seek(column)}
                />
              ))}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
      <p className="debug-panel-note">
        {current < stops.length - 1
          ? `Step ${current} of ${stops.length - 1}: each later step fills in when the playhead reaches it. `
          : ""}
        ▲ and ▼ mark the chances a step raised or lowered. Bars in a table share one scale, each the
        square root of its chance’s share of the table’s largest, so small chances stay visible.
        {layout === "grouped" &&
          " Each table is a group of qubits independent of the others at every step, so an outcome’s chance is the product of its groups’ chances."}
      </p>
    </section>
  );
}

export { ProbabilitiesPanel };
