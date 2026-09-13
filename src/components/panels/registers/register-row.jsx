import { useEffect, useRef, useState } from "react";
import { INPUT_LETTERS } from "../../../circuit/model/InputLetters.js";
import { Registers } from "../../../circuit/model/Registers.js";
import { wireLabel } from "../../../circuit/registerLabels.js";
import { Simulation } from "../../../config/Simulation.js";

/** How many of a register's values are named beside it; any more are counted. */
const SHOWN_VALUES = 4;

/**
 * One register's row: its name, wires and input, each edited in place and applied as one undoable
 * change; the values it holds at the playhead; and its qubits under it.
 */
function RegisterRow({ reading, registers, actions, focused, onDone, onRefused }) {
  const { register, values, qubits } = reading;
  const nameRef = useRef(null);
  useEffect(() => {
    if (focused) {
      const frame = requestAnimationFrame(() => {
        nameRef.current?.focus();
        nameRef.current?.select();
        onDone();
      });
      return () => cancelAnimationFrame(frame);
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
        <span className="registers-swatch" aria-hidden="true" />
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
        <button
          type="button"
          className="registers-remove registers-ungroup"
          aria-label={`Ungroup ${register.name}`}
          title="Ungroup: the wires keep their gates and lose the name"
          onClick={() => onRefused(actions.remove(register.name))}
        >
          ×
        </button>
      </div>
      {/* One line each under the name, all starting past the swatch: its wires and input, the
          values it holds, their labels, and its qubits. */}
      <div className="registers-settings">
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
      </div>
      <div className="registers-values" role="group" aria-label={`Values ${register.name} can hold at the playhead`}>
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
      </div>
      <div className="registers-labels" role="group" aria-label={`Value labels of ${register.name}`}>
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

export { RegisterRow };
