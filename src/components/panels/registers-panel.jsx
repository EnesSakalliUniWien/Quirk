import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { INPUT_LETTERS } from "../../circuit/model/InputLetters.js";
import { Registers } from "../../circuit/model/Registers.js";
import { registerValue, wireLabel } from "../../circuit/registerLabels.js";
import { registerColor } from "../../config/CanvasTheme.js";
import { Simulation } from "../../config/Simulation.js";
import { qubitMarginals } from "../../engine/simulation/qubitMarginals.js";
import { paddedState } from "../../engine/simulation/stepAlgebra.js";
import { appStore } from "../../state/appStore.js";
import { Button } from "../ui/button.jsx";
import { usePlayheadStats } from "./usePlayheadStats.js";

/** How many of a register's values are named beside it; any more are counted. */
const SHOWN_VALUES = 4;
/** A value this unlikely cannot come out. */
const NEGLIGIBLE = 1e-9;

/**
 * Each register at the playhead: the values it can hold with their odds, and each of its qubits'
 * chance of reading 1.
 *
 * @param {!CircuitStats} stats
 * @param {!int} wireCount
 * @returns {!Array.<!{register: !Register, values: !Array.<!{value: !int, p: !number}>,
 *     qubits: !Array.<!{wire: !int, probabilityOne: !number}>}>}
 */
function registerReadings(stats, wireCount) {
  const { registers } = stats.circuitDefinition;
  const state = paddedState(stats.finalState, wireCount);
  const amplitudes = state.rawBuffer();
  const marginals = qubitMarginals(state, wireCount);
  const size = 1 << wireCount;
  const chance = (i) => amplitudes[i * 2] ** 2 + amplitudes[i * 2 + 1] ** 2;
  let total = 0;
  for (let i = 0; i < size; i++) {
    total += chance(i);
  }
  return registers.fittingIn(wireCount).list.map((register) => {
    const odds = new Map();
    for (let i = 0; i < size; i++) {
      const p = chance(i);
      if (p > 0) {
        const value = registerValue(register, i);
        odds.set(value, (odds.get(value) ?? 0) + p);
      }
    }
    // Relative to what is left, so post-selection reads as the odds among the survivors.
    const values = [...odds.entries()]
      .map(([value, p]) => ({ value, p: total > 0 ? p / total : 0 }))
      .filter(({ p }) => p > NEGLIGIBLE)
      .sort((a, b) => b.p - a.p || a.value - b.value);
    return {
      register,
      values,
      qubits: Array.from({ length: register.length }, (_, k) => marginals[register.start + k]),
    };
  });
}

/**
 * One register's row: its name, wires and input, each edited in place and applied as one undoable
 * change; the values it holds at the playhead; and its qubits under it.
 */
function RegisterRow({ reading, color, registers, actions, focused, onDone, onRefused }) {
  const { register, values, qubits } = reading;
  const nameRef = useRef(null);
  useEffect(() => {
    if (focused) {
      nameRef.current?.focus();
      nameRef.current?.select();
      onDone();
    }
  }, [focused, onDone]);

  const apply = (change) => {
    const refused = actions.replace(register.name, { ...register, ...change });
    onRefused(refused);
    return refused === undefined;
  };
  const applyName = () => {
    const name = nameRef.current?.value.trim() ?? register.name;
    if (name !== register.name && !apply({ name })) {
      nameRef.current?.focus();
    }
  };
  // Applied when the field is left or Enter is pressed, like the name: applying every keystroke
  // would move the register through every number typed on the way, one undo step each.
  const applyNumber = (field, text) => {
    const value = Number(text);
    if (Number.isInteger(value) && value !== register[field]) {
      apply({ [field]: value });
    }
  };
  const numberProps = (field) => ({
    onBlur: (event) => applyNumber(field, event.target.value),
    onKeyDown: (event) => {
      if (event.key === "Enter") {
        applyNumber(field, event.target.value);
        event.preventDefault();
      }
    },
  });
  const shown = values.slice(0, SHOWN_VALUES);
  const wires = register.length === 1 ? `q${register.start}` : `q${register.start}–q${register.start + register.length - 1}`;
  const labels = Object.entries(register.labels ?? {}).map(([value, label]) => ({ value: Number(value), label }));
  const [labelValue, setLabelValue] = useState("0");
  const labelRef = useRef(null);
  const addLabel = () => {
    const text = labelRef.current?.value.trim() ?? "";
    if (text === "") {
      return;
    }
    const refused = actions.label(register.name, Number(labelValue), text);
    onRefused(refused);
    if (refused === undefined && labelRef.current !== null) {
      labelRef.current.value = "";
    }
  };

  return (
    <li className="registers-item" data-register={register.name}>
      <div className="registers-row">
        <span className="registers-swatch" style={{ background: color }} aria-hidden="true" />
        <input
          key={register.name}
          ref={nameRef}
          className="registers-input registers-name-input"
          defaultValue={register.name}
          aria-label={`Name of the register on ${wires}`}
          autoComplete="off"
          spellCheck="false"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applyName();
              event.preventDefault();
            }
          }}
          onBlur={applyName}
        />
        <span className="registers-wires">{wires}</span>
        <label className="registers-field">
          first
          <input
            className="registers-input registers-number"
            type="number"
            min="0"
            max={Simulation.MAX_WIRE_COUNT - 1}
            key={`start-${register.start}`}
            defaultValue={register.start}
            aria-label={`First wire of ${register.name}`}
            {...numberProps("start")}
          />
        </label>
        <label className="registers-field">
          qubits
          <input
            className="registers-input registers-number"
            type="number"
            min="1"
            max={Simulation.MAX_WIRE_COUNT}
            key={`length-${register.length}`}
            defaultValue={register.length}
            aria-label={`How many qubits ${register.name} covers`}
            {...numberProps("length")}
          />
        </label>
        <label className="registers-field">
          feeds
          <select
            className="registers-input"
            value={register.input ?? ""}
            aria-label={`The input ${register.name} feeds`}
            onChange={(event) => apply({ input: event.target.value === "" ? undefined : event.target.value })}
          >
            <option value="">none</option>
            {INPUT_LETTERS.map((letter) => (
              <option key={letter} value={letter}>{`input ${letter}`}</option>
            ))}
          </select>
        </label>
        <span className="registers-values" aria-label={`Values ${register.name} can hold at the playhead`}>
          {shown.map(({ value, p }) => (
            // A value reads by its label; choosing one puts it in the label form below.
            <button
              key={value}
              type="button"
              className="registers-value"
              title={`Value ${value}: label it`}
              onClick={() => setLabelValue(String(value))}
            >
              {`${Registers.valueLabel(register, value)} · ${Math.round(p * 1000) / 10}%`}
            </button>
          ))}
          {values.length > SHOWN_VALUES && (
            <span className="registers-value">{`+${values.length - SHOWN_VALUES}`}</span>
          )}
        </span>
        <button
          type="button"
          className="registers-remove"
          aria-label={`Ungroup ${register.name}`}
          title="Ungroup: the wires keep their gates and lose the name"
          onClick={() => onRefused(actions.remove(register.name))}
        >
          ×
        </button>
      </div>
      <div className="registers-labels" aria-label={`Value labels of ${register.name}`}>
        {labels.map(({ value, label }) => (
          <span key={value} className="registers-label">
            <b>{label}</b>
            <span className="registers-label-value">{`= ${value}`}</span>
            <button
              type="button"
              className="registers-label-remove"
              aria-label={`Remove the label ${label} from value ${value} of ${register.name}`}
              onClick={() => onRefused(actions.label(register.name, value, undefined))}
            >
              ×
            </button>
          </span>
        ))}
        <form
          className="registers-label-form"
          onSubmit={(event) => {
            event.preventDefault();
            addLabel();
          }}
        >
          <label className="registers-field">
            label value
            <input
              className="registers-input registers-number"
              type="number"
              min="0"
              max={(1 << register.length) - 1}
              value={labelValue}
              aria-label={`The value of ${register.name} to label`}
              onChange={(event) => setLabelValue(event.target.value)}
            />
          </label>
          <label className="registers-field">
            as
            <input
              ref={labelRef}
              className="registers-input registers-label-input"
              type="text"
              placeholder="A"
              maxLength={16}
              aria-label={`The label for that value of ${register.name}`}
              autoComplete="off"
              spellCheck="false"
            />
          </label>
          <button type="submit" className="registers-remove">Label</button>
        </form>
      </div>
      <ul className="registers-qubits">
        {qubits.map(({ wire, probabilityOne }) => (
          <li key={wire} className="registers-qubit">
            <b>{wireLabel(registers, wire)}</b>
            <span>{`q${wire}`}</span>
            <span>{`P(1) ${probabilityOne.toFixed(2)}`}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

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
  const clearTarget = () => appStore.setState({ registerTarget: undefined });

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
          {readings.map((reading, index) => (
            <RegisterRow
              key={reading.register.name}
              reading={reading}
              color={registerColor(index)}
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
