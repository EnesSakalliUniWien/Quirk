import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { GateColumn } from "../../../circuit/model/GateColumn.js";
import { appStore } from "../../../state/appStore.js";
import { closePanel, openPanel } from "../../dock.jsx";
import { AngleField } from "../../math/angle-field.jsx";
import { AmplitudesEditor } from "./amplitudes-editor.jsx";
import {
  AngleUnit,
  parseAngleExpression,
} from "../../../engine/math/formula/AngleExpression.js";

export function GateParamPanel() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  const target = useStore(appStore, (s) => s.gateParamTarget);
  // Capture the panel's opener once, before a chooser selection mounts an editor.
  const openingControl = useRef(document.activeElement);
  const handOffFocus = useRef(false);
  useEffect(
    () => () => {
      if (handOffFocus.current) return;
      const origin = openingControl.current;
      requestAnimationFrame(() => {
        if (document.querySelector('[data-panel-id="gate-param"]')) return;
        if (origin?.isConnected && origin !== document.body)
          origin.focus({ preventScroll: true });
        else
          document
            .getElementById("gate-parameter-button")
            ?.focus({ preventScroll: true });
      });
    },
    [],
  );
  const close = () => {
    appStore.setState({ gateParamTarget: undefined });
    closePanel("gate-param");
  };
  const findGate = () => {
    handOffFocus.current = true;
    close();
    openPanel("gates");
    requestAnimationFrame(() => {
      const search = document.getElementById("gate-search");
      search?.focus({ preventScroll: true });
      if (search instanceof HTMLInputElement) search.select();
    });
  };
  if (!deps) return null;
  return target ? (
    <ParameterEditor
      key={`${target.col}:${target.row}:${target.gate.serializedId}:${target.gate.param}`}
      deps={deps}
      target={target}
      close={close}
    />
  ) : (
    <ParameterList deps={deps} close={close} findGate={findGate} />
  );
}
/**
 * Focuses at once when the view is already in the document, so a key pressed as it appears - Escape
 * straight after choosing a gate - reaches it. Dockview can mount a floating panel before attaching
 * its container to the document; then the focus waits a frame.
 * @returns {() => void} Cancels a focus still waiting.
 */
function focusOnceAttached(element, focus) {
  if (element?.isConnected) {
    focus();
    return () => {};
  }
  const frame = requestAnimationFrame(focus);
  return () => cancelAnimationFrame(frame);
}
function ParameterList({ deps, close, findGate }) {
  const firstAction = useRef(/** @type {HTMLButtonElement|null} */ (null));
  const bodyRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  useEffect(
    () =>
      focusOnceAttached(firstAction.current, () =>
        firstAction.current?.focus({ preventScroll: true }),
      ),
    [],
  );
  // The circuit, not the whole state: its hand moves with every mouse move over the canvas.
  const definition = useStore(
    deps.displayed,
    (s) => s.value.displayedCircuit.circuitDefinition,
  );
  const entries = useMemo(() => {
    const found = [];
    definition.columns.forEach((column, col) =>
      column.gates.forEach((gate, row) => {
        if (gate?.paramDialog) found.push({ gate, col, row });
      }),
    );
    return found;
  }, [definition]);
  useEffect(() => {
    if (entries.length) return;
    const frame = requestAnimationFrame(() => {
      const body = bodyRef.current;
      const group = appStore.getState().dock?.getPanel("gate-param")?.group;
      if (!body?.isConnected || group?.api.location.type !== "floating") return;
      const currentHeight = group.api.height;
      const bodyHeight = body.getBoundingClientRect().height;
      // A newly attached renderer can report zero group height even after its body exists.
      // Keep the dock's safe default until both measurements describe a usable layout.
      if (
        !Number.isFinite(currentHeight) ||
        currentHeight < 150 ||
        bodyHeight < 100 ||
        bodyHeight > currentHeight
      )
        return;
      const list = body.querySelector(".parameter-targets");
      const header = body.querySelector("header");
      const footer = body.querySelector("footer");
      if (!list || !header || !footer) return;
      const style = getComputedStyle(list);
      const listHeight =
        [...list.children].reduce(
          (height, child) => height + child.getBoundingClientRect().height,
          0,
        ) +
        Number.parseFloat(style.rowGap) * (list.children.length - 1) +
        Number.parseFloat(style.paddingTop) +
        Number.parseFloat(style.paddingBottom);
      const chrome = currentHeight - bodyHeight;
      const height = Math.ceil(
        chrome +
          Number.parseFloat(getComputedStyle(body).paddingTop) +
          listHeight +
          header.getBoundingClientRect().height +
          footer.getBoundingClientRect().height,
      );
      // Only shrink this empty floating view; the dock owns viewport bounds and resizing.
      if (Number.isFinite(height))
        group.api.setSize({
          height: Math.min(currentHeight, Math.max(150, height)),
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [entries.length]);
  return (
    // eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions -- Escape bubbles from the native parameter buttons; the footer also supplies Close.
    <div
      ref={bodyRef}
      className="panel-body gate-param-panel"
      aria-labelledby="gate-param-list-title"
      role="region"
      onKeyDown={(e) => {
        if (
          e.key !== "Escape" ||
          e.defaultPrevented ||
          e.nativeEvent.isComposing
        )
          return;
        e.preventDefault();
        close();
      }}
    >
      <header>
        <h2 id="gate-param-list-title" className="gate-param-title">
          {entries.length ? "Gate parameter" : "No editable parameters yet"}
        </h2>
        <p className="field-description">
          {entries.length
            ? "Choose a gate to edit."
            : "Add a rotation gate such as Rx, Ry, or Rz, then return here to change its angle."}
        </p>
      </header>
      <div className="construction-scroll parameter-targets">
        {entries.length ? (
          entries.map((target, index) => (
            <button
              type="button"
              key={`${target.col}:${target.row}`}
              ref={index === 0 ? firstAction : undefined}
              onClick={() => appStore.setState({ gateParamTarget: target })}
            >
              {target.gate.symbol}({String(target.gate.param ?? "")}) · wire{" "}
              {target.row + 1}, column {target.col + 1}
            </button>
          ))
        ) : (
          <>
            <p className="field-description" id="gate-param-search-hint">
              In the gate palette, search for “rotation”.
            </p>
            <button
              id="gate-param-find-button"
              type="button"
              ref={firstAction}
              aria-describedby="gate-param-search-hint"
              onClick={findGate}
            >
              Find a rotation gate
            </button>
          </>
        )}
      </div>
      <footer className="construction-actions">
        <button type="button" onClick={close}>
          Close
        </button>
      </footer>
    </div>
  );
}
function ParameterEditor({ deps, target, close: closeWindow }) {
  const [text, setText] = useState(String(target.gate.param ?? ""));
  const [unit, setUnit] = useState(AngleUnit.RADIANS);
  const [error, setError] = useState("");
  const [edited, setEdited] = useState(false);
  const inputRef = useRef(null);
  const closing = useRef(false);
  const isAngle = target.gate.paramDialog.angleUnit === AngleUnit.RADIANS;
  const isAmplitudes = target.gate.paramDialog.editor === "amplitudes";
  let parsed, validation;
  if (isAngle) {
    try {
      parsed = parseAngleExpression(text, unit);
    } catch (e) {
      validation = e.message;
    }
  }
  useEffect(
    () =>
      focusOnceAttached(inputRef.current, () => {
        inputRef.current?.focus({ preventScroll: true });
        inputRef.current?.select();
        const scroll = inputRef.current?.closest(".construction-scroll");
        if (scroll) scroll.scrollTop = 0;
      }),
    [],
  );
  const close = () => {
    closing.current = true;
    closeWindow();
  };
  const apply = () => {
    if (closing.current || validation) return;
    const definition =
      deps.displayed.getState().value.displayedCircuit.circuitDefinition;
    const oldGate = definition.gateInSlot(target.col, target.row);
    if (oldGate !== target.gate || !oldGate.paramDialog) {
      close();
      return;
    }
    // Amplitudes left as they were have no text to apply: the param is not one.
    if (isAmplitudes && !edited) {
      close();
      return;
    }
    const value = !edited
      ? String(oldGate.param ?? "")
      : isAngle && unit === AngleUnit.DEGREES
        ? String(parsed.radians)
        : text;
    const result = oldGate.paramDialog.applyText(oldGate, value);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.gate !== oldGate && result.gate.param !== oldGate.param) {
      const cols = [...definition.columns];
      const gates = [...cols[target.col].gates];
      gates[target.row] = result.gate;
      cols[target.col] = new GateColumn(gates);
      deps.revision.commit(
        deps.displayed
          .getState()
          .value.withCircuitDefinition(definition.withColumns(cols))
          .afterTidyingUp()
          .snapshot(),
      );
    }
    close();
  };
  return (
    // eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions -- Delegate Escape and IME Enter protection from form fields; native submit and cancel controls own the actions.
    <form
      className="panel-body gate-param-panel"
      aria-labelledby="gate-param-title"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) {
          if (e.key === "Enter") e.preventDefault();
          return;
        }
        if (e.key !== "Escape" || e.defaultPrevented) return;
        e.preventDefault();
        // Escape closes the open formula help before it cancels the window.
        const help = e.currentTarget.querySelector(".formula-help[open]");
        if (help) help.open = false;
        else close();
      }}
    >
      <header>
        <h2 id="gate-param-title" className="gate-param-title">
          {target.gate.paramDialog.title}
        </h2>
        <p className="field-description">
          Wire {target.row + 1} · Column {target.col + 1}
        </p>
      </header>
      <div className="construction-scroll">
        {isAngle ? (
          <AngleField
            id="gate-param-input"
            value={text}
            unit={unit}
            inputRef={inputRef}
            onKeyboardShow={() => {
              const group = appStore
                .getState()
                .dock?.getPanel("gate-param")?.group;
              const box = group?.api.boundingBox;
              if (group?.api.location.type === "floating" && box) {
                const available =
                  appStore.getState().dock.height - box.top - 16;
                group.api.setSize({
                  height: Math.max(group.api.height, Math.min(560, available)),
                });
              }
            }}
            onChange={(text) => {
              setText(text);
              setEdited(true);
              setError("");
            }}
            onUnitChange={(unit, text) => {
              setUnit(unit);
              setText(text);
            }}
          />
        ) : isAmplitudes ? (
          <AmplitudesEditor
            target={target}
            deps={deps}
            inputRef={inputRef}
            onChange={(text) => {
              setText(text);
              setEdited(true);
              setError("");
            }}
          />
        ) : (
          <>
            <p className="gate-param-message">
              {target.gate.paramDialog.message}
            </p>
            <input
              id="gate-param-input"
              ref={inputRef}
              className="gate-param-input"
              aria-label="Parameter value"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setEdited(true);
                setError("");
              }}
            />
          </>
        )}
        <p
          id="gate-param-error"
          className="field-error"
          role="alert"
          hidden={!error}
        >
          {error}
        </p>
        {isAngle && (
          <details className="formula-help">
            <summary>Formula help</summary>
            <p className="gate-param-message">
              {target.gate.paramDialog.message}
            </p>
          </details>
        )}
      </div>
      <footer className="construction-actions">
        <button id="gate-param-cancel-button" type="button" onClick={close}>
          Cancel
        </button>
        <button
          id="gate-param-apply-button"
          type="submit"
          disabled={!!validation}
        >
          Apply
        </button>
      </footer>
    </form>
  );
}
