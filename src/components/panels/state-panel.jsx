import { useEffect, useState } from "react";
import { useStore } from "zustand";

import { CooldownThrottle } from "../../base/CooldownThrottle.js";
import { phaseColor } from "../../config/CanvasTheme.js";
import { stateTableRows } from "../../engine/simulation/stateTableRows.js";
import { appStore } from "../../state/appStore.js";

/** Milliseconds. Rate-limit on rebuilding the table, which redraws far slower than the canvas. */
const STATE_TABLE_COOLDOWN_MILLIS = 100;

/**
 * @param {!number} v
 * @param {!int} digits
 * @returns {!string}
 */
function forceSign(v, digits) {
  return (v >= 0 ? "+" : "") + v.toFixed(digits);
}

/**
 * The stats at the playhead, sampled no faster than the table can be read. The circuit redraws
 * every frame; re-deriving thousands of amplitude rows that often would spend the whole frame
 * budget on a table nobody can read that fast.
 *
 * @returns {undefined|!{stats: !CircuitStats, wireCount: !int}}
 */
function useThrottledPlayheadStats() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  const [sample, setSample] = useState(undefined);

  useEffect(() => {
    if (deps === undefined) {
      return undefined;
    }
    let latest = undefined;
    const throttle = new CooldownThrottle(
      () => setSample(latest),
      STATE_TABLE_COOLDOWN_MILLIS,
    );
    const unsubscribe = deps.playheadStats.observable().subscribe((value) => {
      latest = value;
      throttle.trigger();
    });
    return unsubscribe;
  }, [deps]);

  return sample;
}

/**
 * The state at the playhead: how many amplitudes the circuit has, and the nonzero ones as a table
 * of ket, probability, amplitude and phase.
 *
 * This is the pattern an algebraic matrix view follows: derive plain rows from the stats with a
 * pure function, and render them under the same rate limit.
 */
function StatePanel() {
  const sample = useThrottledPlayheadStats();
  const wireCount = sample?.wireCount ?? 0;
  const { amplitudeCount, nonzeroCount, rows } =
    sample === undefined
      ? { amplitudeCount: 0, nonzeroCount: 0, rows: [] }
      : stateTableRows(sample.stats, wireCount);

  return (
    <>
      <section
        id="state-panel"
        className="state-panel"
        aria-labelledby="state-panel-heading"
      >
        <header className="state-panel-header">
          <h2 id="state-panel-heading" className="state-panel-heading">
            State at the playhead
          </h2>
          <span id="state-summary" className="state-summary">
            {`${wireCount} qubit${wireCount === 1 ? "" : "s"} · ` +
              `${amplitudeCount} amplitudes · ` +
              `${nonzeroCount} nonzero`}
          </span>
          <span className="state-legend">
            <span>phase</span>
            <span className="state-legend-strip" aria-hidden="true" />
            <span>&#8722;&#960; &#8230; +&#960;</span>
          </span>
        </header>

        <div className="state-table-scroll">
          <table id="state-table" className="state-table">
            <thead>
              <tr>
                <th scope="col">state</th>
                <th scope="col">probability</th>
                <th scope="col">amplitude</th>
                <th scope="col">phase (deg)</th>
              </tr>
            </thead>
            <tbody id="state-table-body">
              {rows.map(({ ket, probability, real, imag, phaseDegrees }) => (
                <tr key={ket}>
                  <td className="state-ket">{`|${ket}⟩`}</td>
                  <td className="state-probability">
                    <span className="state-bar">
                      <span
                        className="state-bar-fill"
                        style={{ width: `${Math.min(100, probability * 100)}%` }}
                      />
                    </span>
                    <span className="state-number">{probability.toFixed(4)}</span>
                  </td>
                  <td className="state-amplitude">
                    {`${forceSign(real, 3)} ${forceSign(imag, 3)}i`}
                  </td>
                  <td className="state-phase">
                    <span
                      className="state-swatch"
                      style={{ background: phaseColor(phaseDegrees) }}
                    />
                    <span className="state-number">{forceSign(phaseDegrees, 2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Never let a cap read as "that's all of them". */}
        <p id="state-truncation-note" className="state-note">
          {nonzeroCount > rows.length
            ? `Showing the first ${rows.length} of ${nonzeroCount} nonzero amplitudes.`
            : ""}
        </p>
      </section>
    </>
  );
}

export { StatePanel };
