/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {GateColumn} from '../../../circuit/model/GateColumn.js';
import {Point} from '../../../geometry/Point.js';

/**
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!PointerInteractionState} hand
 * @returns {undefined|!Object} Proposed definition and drag-state changes; undefined means no edit.
 */
function previewDropMovedRow(context, hand) {
    if (hand.pos === undefined) {
        return undefined;
    }
    let handWire = context.wireIndexAt(hand.pos.y);
    if (handWire < 0 || handWire >= context.definition.numWires) {
        // Dragged the row out of the circuit.
        return undefined;
    }

    const heldRowHeight = Math.max(1, ...hand.heldRow.gates.map(g => g === undefined ? 1 : g.height));
    handWire = Math.min(handWire, context.definition.numWires - heldRowHeight);

    const newCols = [];
    for (let c = 0; c < context.definition.columns.length; c++) {
        const gates = [...context.definition.columns[c].gates];
        gates.splice(handWire, 0, hand.heldRow.gates[c]);
        gates.pop();
        newCols.push(new GateColumn(gates));
    }

    const newInitialStates = new Map(
        [...context.definition.customInitialValues.entries()].
            map(([k, v]) => [k + (k >= handWire ? 1 : 0), v]));
    if (hand.heldRow.initialState !== undefined) {
        newInitialStates.set(handWire, hand.heldRow.initialState);
    }
    // A register the row lands strictly inside takes it in; the ones below move down with the rows.
    const newCircuitDef = context.definition.withColumns(newCols).
        withRegisters(context.definition.registers.afterRowInserted(handWire)).
        withInitialStates(newInitialStates);

    return {definition: newCircuitDef, highlightedSlot: {row: handWire, col: undefined, resizeStyle: false}};
}

/**
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!PointerInteractionState} hand
 * @param {!boolean} alt
 * @returns {undefined|!Object} Proposed definition, drag-state and hand changes.
 */
function tryGrabRow(context, hand, alt) {
    if (hand.pos === undefined) {
        return undefined;
    }

    // Which wire is it? Is it one that's actually in the circuit?
    const wire = context.wireIndexAt(hand.pos.y);
    if (wire < 0 || wire >= context.definition.numWires) {
        return undefined;
    }

    // Is it inside the intended click area, instead of just off to the side?
    const r = context.geometry.wireInitialStateRect(wire);
    if (!r.containsPoint(hand.pos)) {
        return undefined;
    }

    let {newCircuit, initialState, rowGates} = cutRow(context, wire);
    const holdOffset = new Point(0, hand.pos.y - r.y);
    if (alt) {
        rowGates = rowGates.map(e => e === undefined ? e : e.alternate);
    }
    return {
        definition: newCircuit,
        hand: hand.withHeldRow({initialState, gates: rowGates}, holdOffset)
    };
}

/**
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!int} row
 * @returns {!{newCircuit: !CircuitDefinition, rowGates: !Array.<undefined|!Gate>, initialState: *}}
 */
function cutRow(context, row) {
    const row_gates = [];
    const cols = [];
    for (let i = 0; i < context.definition.columns.length; i++) {
        const col_gates = [...context.definition.columns[i].gates];
        row_gates.push(col_gates[row]);
        col_gates.splice(row, 1);
        col_gates.push(undefined);
        cols.push(new GateColumn(col_gates));
    }
    const newInitialStates = new Map(
        [...context.definition.customInitialValues.entries()].
            filter(([k, _]) => k !== row).
            map(([k, v]) => [k - (k > row ? 1 : 0), v]));
    return {
        // The register the row was in loses it; the ones below move up with the rows.
        newCircuit: context.definition.withColumns(cols).
            withRegisters(context.definition.registers.afterRowRemoved(row)).
            withInitialStates(newInitialStates),
        rowGates: row_gates,
        initialState: context.definition.customInitialValues.get(row)
    };
}

export {previewDropMovedRow, tryGrabRow};
