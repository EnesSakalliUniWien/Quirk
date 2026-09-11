import { ketBitsHeader } from "../../circuit/registerLabels.js";
import { phaseColor } from "../../config/CanvasTheme.js";
import { stateTableRows } from "../../engine/simulation/stateTableRows.js";
import { usePlayheadStats } from "./usePlayheadStats.js";

/**
 * @param {!number} v
 * @param {!int} digits
 * @returns {!string}
 */
function forceSign(v, digits) {
  return (v >= 0 ? "+" : "") + v.toFixed(digits);
}

/**
 * The state at the playhead: how many amplitudes the circuit has, and the nonzero ones as a table
 * of ket, probability, amplitude and phase.
 *
 * This is the pattern an algebraic matrix view follows: derive plain rows from the stats with a
 * pure function, and render them under the same rate limit.
 */
function StatePanel() {
  const sample = usePlayheadStats();
  const wireCount = sample?.wireCount ?? 0;
  const { amplitudeCount, nonzeroCount, rows, registers } =
    sample === undefined
      ? { amplitudeCount: 0, nonzeroCount: 0, rows: [], registers: undefined }
      : stateTableRows(sample.stats, wireCount);
  // With registers, each gets a column of its values, and the kets become the bits grouped by them.
  const named = registers !== undefined && !registers.isEmpty();
  // Two or more registers also read together, as a sequence: AGA for three bases.
  const sequenced = named && registers.list.length >= 2;

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
          <table id="state-table" className={named ? "state-table state-table-registers" : "state-table"}>
            <thead>
              <tr>
                {named &&
                  registers.list.map((register) => (
                    <th key={register.name} scope="col">
                      {register.name}
                    </th>
                  ))}
                {sequenced && (
                  <th scope="col" title="The registers' values read together, in wire order">
                    sequence
                  </th>
                )}
                <th scope="col" title={named ? "The bits, highest wire first, grouped by register" : undefined}>
                  {named ? ketBitsHeader(registers, wireCount) : "state"}
                </th>
                <th scope="col">probability</th>
                <th scope="col">amplitude</th>
                <th scope="col">phase (deg)</th>
              </tr>
            </thead>
            <tbody id="state-table-body">
              {rows.map(({ ket, bits, values, sequence, probability, real, imag, phaseDegrees }) => (
                <tr key={ket}>
                  {named &&
                    values.map((value, index) => (
                      <td key={index} className="state-register">
                        {value}
                      </td>
                    ))}
                  {sequenced && <td className="state-sequence">{sequence}</td>}
                  <td className="state-ket">{`|${named ? bits : ket}⟩`}</td>
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
