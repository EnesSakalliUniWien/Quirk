import { GateColumn } from "../../circuit/model/GateColumn.js";
import { Simulation } from "../../config/Simulation.js";
import {
  expandToWholeGates,
  gatesMeetingRange,
  occupiedColumns,
  outsideDependencies,
  sliceCircuit,
} from "../../circuit/circuitRange.js";
import {
  circuitFromClipboardText,
  circuitToClipboardText,
} from "../../serialization/circuits/clipboard.js";

/**
 * The selected part of the circuit, and what can be done with it: copy it, cut or delete its gates,
 * and paste a copied part back in. Each edit is one commit, so undo, redo and the URL follow them.
 *
 * The selection is UI state, kept in the store it is given together with the circuit it was made
 * on. It lasts while that circuit is shown and goes when an edit it did not make changes the
 * circuit: after an edit, the same columns would be other gates. A selection always holds whole
 * gates and at least one of them.
 */
class SelectionActions {
  /**
   * @param {!Revision} revision
   * @param {import("zustand/vanilla").StoreApi<{value: !EditorState}>} displayed
   * @param {import("zustand/vanilla").StoreApi<{circuitSelection: (undefined|!{circuitJson: !string, range: !CircuitRange})}>} store
   */
  constructor(revision, displayed, store) {
    this._revision = revision;
    this._displayed = displayed;
    this._store = store;
    /** @type {undefined|!{state: !EditorState, json: !string}} */
    this._lastSnapshot = undefined;
  }

  /**
   * @returns {!CircuitDefinition} The circuit now.
   */
  current() {
    return this._displayed.getState().value.displayedCircuit.circuitDefinition;
  }

  /**
   * @returns {undefined|!CircuitRange} The selected range, while the circuit it was made on is
   *     the one shown.
   */
  range() {
    const selection = this._store.getState().circuitSelection;
    return selection !== undefined && selection.circuitJson === this._snapshot()
      ? selection.range
      : undefined;
  }

  /**
   * Selects the range, grown to whole gates and kept inside the circuit. A range holding no gate
   * selects nothing.
   *
   * @param {undefined|!CircuitRange} range
   * @returns {!boolean} Whether something is selected now.
   */
  select(range) {
    const definition = this.current();
    const clamped =
      range === undefined
        ? undefined
        : {
            colStart: Math.max(0, range.colStart),
            colEnd: Math.min(occupiedColumns(definition), range.colEnd),
            wireStart: Math.max(0, range.wireStart),
            wireEnd: Math.min(definition.numWires, range.wireEnd),
          };
    if (
      clamped === undefined ||
      clamped.colStart >= clamped.colEnd ||
      clamped.wireStart >= clamped.wireEnd
    ) {
      this.clear();
      return false;
    }
    const whole = expandToWholeGates(definition, clamped);
    if (gatesMeetingRange(definition, whole).length === 0) {
      this.clear();
      return false;
    }
    this._store.setState({
      circuitSelection: { circuitJson: this._snapshot(), range: whole },
    });
    return true;
  }

  /**
   * @returns {!boolean} Whether the circuit has a gate to select.
   */
  selectAll() {
    const definition = this.current();
    return this.select({
      colStart: 0,
      colEnd: occupiedColumns(definition),
      wireStart: 0,
      wireEnd: definition.numWires,
    });
  }

  clear() {
    if (this._store.getState().circuitSelection !== undefined) {
      this._store.setState({ circuitSelection: undefined });
    }
  }

  /**
   * Drops a selection made on a circuit that is no longer the one shown. Called after each commit,
   * undo and redo; a drag in progress shows another circuit only for a while, so it is not one.
   */
  forgetIfChanged() {
    const selection = this._store.getState().circuitSelection;
    if (selection !== undefined && selection.circuitJson !== this._snapshot()) {
      this.clear();
    }
  }

  /**
   * @returns {!Array.<!Object>} What the selected gates rely on from outside the selection, which a
   *     copy leaves behind (src/circuit/circuitRange.js's outsideDependencies).
   */
  outsideDependencies() {
    const range = this.range();
    return range === undefined
      ? []
      : outsideDependencies(this.current(), range);
  }

  /**
   * @returns {undefined|!string} The selected gates as circuit JSON, the selection's first column
   *     and wire as the copy's first. Custom gates carry their definitions, so the text pastes
   *     into any circuit.
   */
  copyText() {
    const range = this.range();
    return range === undefined
      ? undefined
      : circuitToClipboardText(
          sliceCircuit(this.current(), range).withUncoveredColumnsRemoved(),
        );
  }

  /**
   * Deletes the selected gates, in one commit. The selection goes with them.
   *
   * @returns {!boolean} Whether the circuit changed.
   */
  remove() {
    const range = this.range();
    if (range === undefined) {
      return false;
    }
    const definition = this.current();
    const inside = new Set(
      gatesMeetingRange(definition, range).map(
        ({ col, row }) => `${col}:${row}`,
      ),
    );
    this._commit(
      definition.withColumns(
        definition.columns.map(
          (column, col) =>
            new GateColumn(
              column.gates.map((gate, row) =>
                inside.has(`${col}:${row}`) ? undefined : gate,
              ),
            ),
        ),
      ),
    );
    this.clear();
    return true;
  }

  /**
   * @returns {undefined|!string} The selected gates as circuit JSON, removed from the circuit in
   *     one commit; undefined when nothing is selected.
   */
  cut() {
    const text = this.copyText();
    if (text !== undefined) {
      this.remove();
    }
    return text;
  }

  /**
   * @returns {!boolean} Whether every selected gate is switched off, so the selection's switch
   *     offers to turn them back on.
   */
  allDeactivated() {
    const range = this.range();
    return (
      range !== undefined &&
      gatesMeetingRange(this.current(), range).every(
        ({ gate }) => gate.deactivated,
      )
    );
  }

  /**
   * Switches every selected gate off, or back on, in one commit. Off, a gate keeps its slot but the
   * simulation skips it. The selection stays on the same gates.
   *
   * @param {!boolean} deactivated
   * @returns {!boolean} Whether the circuit changed.
   */
  setDeactivated(deactivated) {
    const range = this.range();
    if (range === undefined) {
      return false;
    }
    const definition = this.current();
    const inside = new Set(
      gatesMeetingRange(definition, range)
        .filter(({ gate }) => gate.deactivated !== deactivated)
        .map(({ col, row }) => `${col}:${row}`),
    );
    if (inside.size === 0) {
      return false;
    }
    this._commit(
      definition.withColumns(
        definition.columns.map(
          (column, col) =>
            new GateColumn(
              column.gates.map((gate, row) =>
                inside.has(`${col}:${row}`)
                  ? gate.withDeactivated(deactivated)
                  : gate,
              ),
            ),
        ),
      ),
    );
    this.select(range);
    return true;
  }

  /**
   * Inserts copied gates as new columns, so nothing already in the circuit is overwritten: the
   * columns from the insertion point on move right. One commit, and the pasted gates are selected
   * after it. Registers and initial states in the text are not pasted.
   *
   * @param {!string} text Circuit JSON, as copyText writes it.
   * @param {undefined|!{col: !int, row: !int}} at The column to insert before and the wire the
   *     copy's first wire lands on. By default, after the selection, or else after the circuit.
   * @returns {!{range: !CircuitRange}|!{error: !string, notCircuit: (undefined|!boolean)}} notCircuit
   *     marks text that holds no circuit at all, which a paste elsewhere may want instead.
   */
  paste(text, at = undefined) {
    const copied = circuitFromClipboardText(text);
    if (copied === undefined) {
      return {
        error: "The clipboard does not contain a Quirk circuit.",
        notCircuit: true,
      };
    }
    const block = copied.withUncoveredColumnsRemoved();
    const gates = block.columns.flatMap((column) =>
      column.gates.filter((gate) => gate !== undefined),
    );
    if (gates.length === 0) {
      return { error: "The copied circuit has no gates." };
    }
    if (gates.some((gate) => gate.name === "Parse Error")) {
      return {
        error: "The copied circuit has gates this version does not know.",
      };
    }
    const width = occupiedColumns(block);
    const height = Math.max(
      ...block.columns.map((column) => column.minimumRequiredWireCount()),
    );
    if (height > Simulation.MAX_WIRE_COUNT) {
      return {
        error: `A pasted part can span at most ${Simulation.MAX_WIRE_COUNT} wires.`,
      };
    }

    let definition = this.current();
    const { col, row } = this._placement(definition, at, height);
    definition = definition.withWireCount(
      Math.max(definition.numWires, row + height),
    );
    const { definition: withGates, columns: blockColumns } = withCustomGatesOf(
      definition,
      block,
    );
    const numWires = withGates.numWires;
    // A wide gate at the end of the circuit can reach past its last column.
    const existing = [
      ...withGates.columns,
      ...Array.from(
        { length: Math.max(0, col - withGates.columns.length) },
        () => new GateColumn(new Array(numWires).fill(undefined)),
      ),
    ];
    const inserted = Array.from(
      { length: width },
      (_, c) =>
        new GateColumn(
          Array.from({ length: numWires }, (_, r) =>
            r < row || r >= row + height
              ? undefined
              : blockColumns[c]?.gates[r - row],
          ),
        ),
    );
    this._commit(
      withGates.withColumns([
        ...existing.slice(0, col),
        ...inserted,
        ...existing.slice(col),
      ]),
    );

    const range = {
      colStart: col,
      colEnd: col + width,
      wireStart: row,
      wireEnd: row + height,
    };
    this.select(range);
    return { range: this.range() ?? range };
  }

  /**
   * @param {!CircuitDefinition} definition
   * @param {undefined|!{col: !int, row: !int}} at
   * @param {!int} height
   * @returns {!{col: !int, row: !int}} Where a pasted block of the height goes: inside the circuit
   *     and its wire limit, and never inside a wide gate's footprint.
   * @private
   */
  _placement(definition, at, height) {
    const range = this.range();
    const target =
      at ??
      (range !== undefined
        ? { col: range.colEnd, row: range.wireStart }
        : { col: definition.columns.length, row: 0 });
    let col = Math.max(0, Math.min(occupiedColumns(definition), target.col));
    const row = Math.max(
      0,
      Math.min(Simulation.MAX_WIRE_COUNT - height, target.row),
    );
    for (let moved = true; moved;) {
      moved = false;
      definition.columns.forEach((column, c) =>
        column.gates.forEach((gate) => {
          if (gate !== undefined && c < col && col < c + gate.width) {
            col = c + gate.width;
            moved = true;
          }
        }),
      );
    }
    return { col, row };
  }

  /**
   * @param {!CircuitDefinition} definition
   * @private
   */
  _commit(definition) {
    const state = this._displayed
      .getState()
      .value.withCircuitDefinition(definition)
      .afterTidyingUp()
      .withJustEnoughWires(0);
    this._revision.commit(state.snapshot());
  }

  /**
   * @returns {!string} The shown circuit's JSON, remembered while the shown state is the same.
   * @private
   */
  _snapshot() {
    const state = this._displayed.getState().value;
    if (this._lastSnapshot?.state !== state) {
      this._lastSnapshot = { state, json: state.snapshot() };
    }
    return this._lastSnapshot.json;
  }
}

/**
 * Brings a copied block's custom gates into the circuit. A custom gate is its serialized id - ids
 * are random and a gate is never edited in place - so one the circuit already has is used as the
 * circuit's own, and one it lacks is added to its custom gates, where the toolbox shows it.
 *
 * @param {!CircuitDefinition} definition
 * @param {!CircuitDefinition} block
 * @returns {!{definition: !CircuitDefinition, columns: !Array.<!GateColumn>}}
 */
function withCustomGatesOf(definition, block) {
  let result = definition;
  const own = (gate) => {
    if (gate === undefined) {
      return undefined;
    }
    if (gate.deactivated) {
      return own(gate.withDeactivated(false)).withDeactivated(true);
    }
    if (!gate.serializedId.startsWith("~")) {
      return gate;
    }
    const known = result.customGateSet.findGateWithSerializedId(
      gate.serializedId,
    );
    if (known !== undefined) {
      return known;
    }
    result = result.withCustomGate(gate);
    return gate;
  };
  const columns = block.columns.map(
    (column) => new GateColumn(column.gates.map(own)),
  );
  return { definition: result, columns };
}

export { SelectionActions };
