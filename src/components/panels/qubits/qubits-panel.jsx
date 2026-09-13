import { useMemo } from "react";

import { wireLabel } from "../../../circuit/registerLabels.js";
import { qubitReadings } from "../../../engine/simulation/qubitMarginals.js";
import { usePlayheadStats } from "../shared/usePlayheadStats.js";

/** Purity this close to 1 reads as a qubit in a state of its own. */
const PURE = 0.999;

/**
 * @param {!number} v
 * @returns {!string}
 */
function signed(v) {
  const rounded = Math.abs(v) < 0.0005 ? 0 : v;
  return (rounded >= 0 ? "+" : "−") + Math.abs(rounded).toFixed(3);
}

/**
 * Each qubit on its own at the playhead: how likely it reads 1, where it sits on the Bloch sphere,
 * and how pure it is. A purity under 1 is the panel's point - it shows, step by step, which qubits
 * the circuit has entangled with the rest.
 */
function QubitsPanel() {
  const sample = usePlayheadStats();
  const marginals = useMemo(
    () =>
      sample === undefined
        ? undefined
        : qubitReadings(sample.stats, sample.wireCount),
    [sample],
  );

  if (marginals === undefined) {
    return <p className="debug-panel-empty">Waiting for the circuit…</p>;
  }

  const { registers } = sample.stats.circuitDefinition;
  return (
    <section className="debug-panel" aria-labelledby="qubits-heading">
      <header className="debug-panel-header">
        <h2 id="qubits-heading" className="debug-panel-heading">
          Qubits at the playhead
        </h2>
        <span className="debug-panel-summary">
          {`${marginals.filter((q) => q.purity < PURE).length} of ${marginals.length} mixed`}
        </span>
      </header>
      <div className="qubits-table-scroll">
        <table className="qubits-table">
          <thead>
            <tr>
              <th scope="col">qubit</th>
              <th scope="col">P(1)</th>
              <th scope="col">Bloch x</th>
              <th scope="col">Bloch y</th>
              <th scope="col">Bloch z</th>
              <th scope="col">purity</th>
            </tr>
          </thead>
          <tbody>
            {marginals.map(({ wire, probabilityOne, bloch, purity }) => (
              <tr key={wire} data-qubit={wire}>
                <th scope="row" className="qubits-name">{wireLabel(registers, wire)}</th>
                <td>
                  <span className="qubits-bar" aria-hidden="true">
                    <span className="qubits-bar-fill" style={{ width: `${probabilityOne * 100}%` }} />
                  </span>
                  <span className="qubits-number">{probabilityOne.toFixed(3)}</span>
                </td>
                <td className="qubits-number">{signed(bloch.x)}</td>
                <td className="qubits-number">{signed(bloch.y)}</td>
                <td className="qubits-number">{signed(bloch.z)}</td>
                <td>
                  <span className={purity < PURE ? "qubits-purity qubits-mixed" : "qubits-purity"}>
                    {purity.toFixed(3)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="debug-panel-note">
        Purity is 1 for a qubit in a state of its own and 0.5 for one maximally entangled with the
        others. Without measurement or post-selection, anything below 1 is entanglement.
      </p>
    </section>
  );
}

export { QubitsPanel };
