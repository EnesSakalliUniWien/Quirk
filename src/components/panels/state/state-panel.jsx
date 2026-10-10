import { signedFixed } from "../../../base/Format.js";
import { useColourScheme } from "../../useColourScheme.js";
import { useMemo } from "react";

import { ketBitsHeader } from "../../../circuit/registerLabels.js";
import { phaseColor } from "../../../config/CanvasTheme.js";
import { stateTableRows } from "../../../engine/simulation/stateTableRows.js";
import { usePlayheadStats } from "../shared/usePlayheadStats.js";
import { useVisibleRows } from "./useVisibleRows.js";

/** What the table holds before the circuit has started. */
const NO_STATE = {
  amplitudeCount: 0,
  nonzeroCount: 0,
  rows: [],
  registers: undefined,
};

/**
 * The characters of the longest thing a register's column holds: its name, or the value written
 * out as a number, or a label the value was given.
 *
 * @param {!Register} register
 * @returns {!int}
 */
function registerColumnChars(register) {
  return Object.values(register.labels ?? {}).reduce(
    (widest, label) => Math.max(widest, label.length),
    Math.max(register.name.length, String((1 << register.length) - 1).length),
  );
}

/**
 * A column that fits so many characters of the table's monospace font between its cells' padding.
 * The table's layout is fixed, so only the widths set here and in the stylesheet size its columns,
 * and they must hold for rows that are not rendered yet.
 *
 * @param {!number} chars
 * @returns {!{width: !string}}
 */
function charColumn(chars) {
  return { width: `calc(${chars}ch + var(--spacing) * 6)` };
}

/**
 * The rows that are not rendered, as one row of their height, so the table is as tall as all of its
 * rows and the scroll bar is the size of the whole list. Assistive technology skips it: the
 * rendered rows say where they are in the table with their aria-rowindex.
 *
 * @param {!{height: !number, columnCount: !int}} props
 */
function SpacerRow({ height, columnCount }) {
  return (
    <tr className="state-spacer" aria-hidden="true" style={{ height }}>
      <td colSpan={columnCount} />
    </tr>
  );
}

/**
 * The state at the playhead: how many amplitudes the circuit has, and the nonzero ones as a table
 * of ket, probability, amplitude and phase.
 *
 * This is the pattern an algebraic matrix view follows: derive plain rows from the stats with a
 * pure function, and render them under the same rate limit. Twelve qubits can fill the table with
 * four thousand rows, so it renders only the rows in view and a few either side, and stands in for
 * the rest with two spacer rows that keep the table's height.
 */
function StatePanel() {
  useColourScheme();
  const sample = usePlayheadStats();
  const wireCount = sample?.wireCount ?? 0;
  const stats = sample?.stats;
  // The rows follow the stats alone: a render for any other reason, such as a scroll, reuses them.
  const { amplitudeCount, nonzeroCount, rows, registers } = useMemo(
    () => (stats === undefined ? NO_STATE : stateTableRows(stats, wireCount)),
    [stats, wireCount],
  );
  const { scrollRef, start, end, before, after } = useVisibleRows(rows.length);
  // With registers, each gets a column of its values, and the kets become the bits grouped by them.
  const named = registers !== undefined && !registers.isEmpty();
  // Two or more registers also read together, as a sequence: AGA for three bases.
  const sequenced = named && registers.list.length >= 2;
  const columnCount =
    (named ? registers.list.length : 0) + (sequenced ? 1 : 0) + 4;
  const ketHeader = named ? ketBitsHeader(registers, wireCount) : "state";
  // The ket column fits its longest cell or its header: |, the bits, a dot between registers, and ⟩.
  const ketChars = Math.max(
    ketHeader.length,
    wireCount + (named ? registers.list.length : 0) + 2,
  );
  const registerChars = named ? registers.list.map(registerColumnChars) : [];
  // The sequence reads the registers' values in a row, with a dot between them, and its letters are
  // spaced a little apart (state.css).
  const sequenceChars = Math.max(
    8,
    Math.ceil(
      1.15 *
        (registerChars.reduce((sum, chars) => sum + chars, 0) +
          registerChars.length -
          1),
    ),
  );

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

        {sample?.stats.circuitDefinition.colIsMeasuredMask(Infinity) !== 0 &&
          sample !== undefined && (
            <p className="debug-panel-note">
              Deferred measurement: these simulation amplitudes do not describe
              a physical pure state. Read the Qubits panel for measurement-aware
              Bloch vectors and purity.
            </p>
          )}
        {sample && (
          <div className="state-measurements">
            {Object.entries(sample.stats.sampleOutcomes).map(([key, value]) => (
              <p key={key}>
                Sample {key}: {value.i} (probability {value.p.toPrecision(6)};
                no collapse)
              </p>
            ))}
            {[...sample.stats.customStatsEntries()]
              .filter(([, value]) => typeof value === "boolean")
              .map(([key, value]) => (
                <p key={key}>
                  Detector {key}: {value ? "click" : "no click"}
                </p>
              ))}
          </div>
        )}
        <div ref={scrollRef} className="state-table-scroll">
          <table
            id="state-table"
            className={
              named ? "state-table state-table-registers" : "state-table"
            }
            aria-rowcount={rows.length + 1}
          >
            <colgroup>
              {named &&
                registers.list.map((register, index) => (
                  <col
                    key={register.name}
                    className="state-register"
                    style={charColumn(registerChars[index])}
                  />
                ))}
              {sequenced && (
                <col
                  className="state-sequence"
                  style={charColumn(sequenceChars)}
                />
              )}
              <col className="state-ket" style={charColumn(ketChars)} />
              <col className="state-probability" />
              <col className="state-amplitude" />
              <col className="state-phase" />
            </colgroup>
            <thead>
              <tr aria-rowindex={1}>
                {named &&
                  registers.list.map((register) => (
                    <th key={register.name} scope="col">
                      {register.name}
                    </th>
                  ))}
                {sequenced && (
                  <th
                    scope="col"
                    title="The registers' values read together, in wire order"
                  >
                    sequence
                  </th>
                )}
                <th
                  scope="col"
                  title={
                    named
                      ? "The bits, highest wire first, grouped by register"
                      : undefined
                  }
                >
                  {ketHeader}
                </th>
                <th scope="col">probability</th>
                <th scope="col">amplitude</th>
                <th scope="col">phase (deg)</th>
              </tr>
            </thead>
            <tbody id="state-table-body">
              {before > 0 && (
                <SpacerRow height={before} columnCount={columnCount} />
              )}
              {rows
                .slice(start, end)
                .map(
                  (
                    {
                      ket,
                      bits,
                      values,
                      sequence,
                      probability,
                      real,
                      imag,
                      phaseDegrees,
                    },
                    offset,
                  ) => (
                    <tr key={ket} aria-rowindex={start + offset + 2}>
                      {named &&
                        values.map((value, index) => (
                          <td key={index} className="state-register">
                            {value}
                          </td>
                        ))}
                      {sequenced && (
                        <td className="state-sequence">{sequence}</td>
                      )}
                      <td className="state-ket">{`|${named ? bits : ket}⟩`}</td>
                      <td className="state-probability">
                        <span className="state-bar">
                          <span
                            className="state-bar-fill"
                            style={{
                              width: `${Math.min(100, probability * 100)}%`,
                            }}
                          />
                        </span>
                        <span className="state-number">
                          {probability.toFixed(4)}
                        </span>
                      </td>
                      <td className="state-amplitude">
                        {`${signedFixed(real, 3)} ${signedFixed(imag, 3)}i`}
                      </td>
                      <td className="state-phase">
                        <span
                          className="state-swatch"
                          style={{ background: phaseColor(phaseDegrees) }}
                        />
                        <span className="state-number">
                          {signedFixed(phaseDegrees, 2)}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              {after > 0 && (
                <SpacerRow height={after} columnCount={columnCount} />
              )}
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
