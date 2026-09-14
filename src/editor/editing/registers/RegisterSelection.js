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



/**
 * The circuit with a register over the wires picked so far, when they are all free: shown while
 * the drag goes on, and made when it ends. A register only names its wires, so making one changes
 * nothing about what the circuit does.
 *
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!PointerInteractionState} hand
 * @returns {undefined|!Object} Proposed definition and drag-state changes; undefined means no edit.
 */
function previewNewRegister(context, hand) {
    if (hand.pos === undefined) {
        return undefined;
    }
    const def = context.definition;
    const to = Math.max(0, Math.min(def.numWires - 1, context.wireIndexAt(hand.pos.y)));
    const first = Math.min(hand.selectingWires, to);
    const wires = Array.from({length: Math.abs(to - hand.selectingWires) + 1}, (_, i) => first + i);
    if (wires.some(wire => def.registers.covers(wire))) {
        return undefined;
    }
    const register = {name: def.registers.nextFreeName(), start: first, length: wires.length, input: undefined};
    return {definition: def.withRegisters(def.registers.withRegister(register))};
}

/**
 * A press on the label of a wire outside every register starts picking wires for a new one.
 *
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!PointerInteractionState} hand
 * @returns {undefined|!Object} Proposed definition, drag-state and hand changes.
 */
function tryStartWireSelection(context, hand) {
    if (hand.pos === undefined) {
        return undefined;
    }
    const wire = context.wireIndexAt(hand.pos.y);
    const def = context.definition;
    if (wire < 0 || wire >= def.numWires || def.registers.covers(wire) ||
            !context.geometry.wireIndexRect(wire).containsPoint(hand.pos)) {
        return undefined;
    }
    return {hand: hand.withSelectingWires(wire)};
}

export {previewNewRegister, tryStartWireSelection};
