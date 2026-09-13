import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { GateColumn } from "../../../circuit/model/GateColumn.js";
import { appStore } from "../../../state/appStore.js";
import { closePanel } from "../../dock.jsx";

/**
 * The in-app replacement for the browser prompt that parametrized gates used: clicking a gate's
 * button opens this panel, and applying commits a copy of the circuit with the reparametrized gate
 * in place.
 *
 * Which gate is being edited is transient state, set by the click that opened the panel, so it is
 * never written into the dock's saved layout.
 */
function GateParamPanel() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  const target = useStore(appStore, (s) => s.gateParamTarget);
  const inputRef = useRef(null);
  const [error, setError] = useState(undefined);
  // The gate being edited, as a key: a different one remounts the field, so it starts from that
  // gate's value rather than whatever was left in the last edit.
  const targetKey =
    target === undefined ? "none" : `${target.col}:${target.row}:${target.gate.param}`;
  const seeded = target?.gate.param === undefined ? "" : "" + target.gate.param;

  // The browser prompt this panel replaces started with its text selected, so typing replaces the
  // old value. A layout effect, so the selection is in place before the frame is painted, and
  // uncontrolled input above, so the value is already in the DOM when this runs.
  useLayoutEffect(() => {
    setError(undefined);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [targetKey]);

  if (target === undefined || deps === undefined) {
    return (
      <div className="panel-body gate-param-panel">
        <p className="gate-param-message">Click a gate's button to edit its parameter.</p>
      </div>
    );
  }

  const close = () => {
    appStore.setState({ gateParamTarget: undefined });
    closePanel("gate-param");
  };

  const apply = () => {
    const { col, row } = target;
    const circuitDefinition = deps.displayed.get().displayedCircuit.circuitDefinition;
    const oldGate = circuitDefinition.gateInSlot(col, row);
    // The slot may not hold the clicked gate any more (e.g. the URL changed underneath the
    // panel); applying to whatever took its place would edit the wrong gate.
    if (oldGate !== target.gate || oldGate.paramDialog === undefined) {
      close();
      return;
    }

    const result = oldGate.paramDialog.applyText(oldGate, inputRef.current?.value ?? "");
    if (result.error !== undefined) {
      setError(result.error);
      return;
    }

    close();
    if (result.gate !== oldGate && result.gate.param !== oldGate.param) {
      const cols = [...circuitDefinition.columns];
      const gates = [...cols[col].gates];
      gates.splice(row, 1, result.gate);
      cols.splice(col, 1, new GateColumn(gates));
      const newInspector = deps.displayed
        .get()
        .withCircuitDefinition(circuitDefinition.withColumns(cols));
      deps.revision.commit(newInspector.afterTidyingUp().snapshot());
    }
  };

  return (
    <>
      <div className="panel-body gate-param-panel" aria-labelledby="gate-param-title">
        <header className="panel-header">
          <h2 id="gate-param-title" className="gate-param-title">
            {target.gate.paramDialog.title}
          </h2>
        </header>
        <p id="gate-param-message" className="gate-param-message">
          {target.gate.paramDialog.message}
        </p>
        <input
          id="gate-param-input"
          key={targetKey}
          ref={inputRef}
          className="gate-param-input"
          type="text"
          aria-label="Parameter value"
          autoComplete="off"
          spellCheck="false"
          defaultValue={seeded}
          onChange={() => setError(undefined)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              apply();
              event.preventDefault();
            }
          }}
          onFocus={(event) => event.target.select()}
        />
        <p id="gate-param-error" className="gate-param-error" role="alert" hidden={error === undefined}>
          {error}
        </p>
        <div className="panel-action-row gate-param-actions">
          <button id="gate-param-apply-button" type="button" onClick={apply}>
            Apply
          </button>
          <button id="gate-param-cancel-button" type="button" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

export { GateParamPanel };
