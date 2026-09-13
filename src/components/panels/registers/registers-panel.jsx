import { useCallback, useMemo, useState } from "react";
import { useStore } from "zustand";
import { appStore } from "../../../state/appStore.js";
import { Button } from "../../ui/button.jsx";
import { usePlayheadStats } from "../shared/usePlayheadStats.js";
import { registerReadings } from "./registerReadings.js";
import { RegisterRow } from "./register-row.jsx";

/**
 * The Registers panel: every register as a row edited in place - name, wires, the input it feeds -
 * with the values it holds at the playhead and its qubits' odds of reading 1. A register names
 * wires; how they start is a prepare box on the circuit.
 */
function RegistersPanel() {
  const sample = usePlayheadStats();
  const actions = useStore(appStore, (s) => s.registerActions);
  const target = useStore(appStore, (s) => s.registerTarget);
  const [error, setError] = useState(undefined);
  const readings = useMemo(
    () => (sample === undefined ? undefined : registerReadings(sample.stats, sample.wireCount)),
    [sample],
  );
  const clearTarget = useCallback(() => appStore.setState({ registerTarget: undefined }), []);

  if (readings === undefined || actions === undefined) {
    return <p className="debug-panel-empty">Waiting for the circuit…</p>;
  }
  const { registers } = sample.stats.circuitDefinition;
  const add = () => {
    const name = actions.add();
    if (name !== undefined) {
      appStore.setState({ registerTarget: name });
    }
  };

  return (
    <section className="debug-panel registers-panel" aria-labelledby="registers-heading">
      <header className="debug-panel-header">
        <h2 id="registers-heading" className="debug-panel-heading">
          Registers at the playhead
        </h2>
        <span className="debug-panel-summary">
          {`${readings.length} register${readings.length === 1 ? "" : "s"}`}
        </span>
      </header>

      {readings.length > 0 ? (
        <ul className="registers-list">
          {readings.map((reading) => (
            <RegisterRow
              key={reading.register.name}
              reading={reading}
              registers={registers}
              actions={actions}
              focused={target === reading.register.name}
              onDone={clearTarget}
              onRefused={setError}
            />
          ))}
        </ul>
      ) : (
        <p className="debug-panel-note">
          No registers yet. Drag down the circuit's wire labels, right-click one, or add a register
          here. To start a register in a state, put a prepare box on its wires.
        </p>
      )}

      <p id="registers-error" className="registers-error" role="alert">
        {error}
      </p>
      <div className="panel-action-row">
        <Button id="registers-add-button" onClick={add}>
          Add register
        </Button>
      </div>
    </section>
  );
}

export { RegistersPanel };
