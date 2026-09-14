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

import {z} from 'zod';
import {Gate} from '../../circuit/model/Gate.js';
import {GateColumn} from '../../circuit/model/GateColumn.js';
import {Point} from '../../geometry/Point.js';
import {equate} from '../../base/Equate.js';

const point = z.instanceof(Point);
const operationSchema = z.discriminatedUnion('type', [
    z.strictObject({type: z.literal('idle')}),
    z.strictObject({type: z.literal('gate'), gate: z.instanceof(Gate), offset: point}),
    z.strictObject({type: z.literal('column'), column: z.instanceof(GateColumn), offset: point}),
    z.strictObject({type: z.literal('row'), row: z.strictObject({
        initialState: z.unknown(), gates: z.array(z.instanceof(Gate).optional())
    }), offset: point}),
    z.strictObject({type: z.literal('resize'), slot: point, offset: point}),
    z.strictObject({type: z.literal('select-wires'), wire: z.int().nonnegative()})
]);
const validatedOperations = new WeakSet();
const idle = Object.freeze({type: 'idle'});
validatedOperations.add(idle);
const freezePoint = p => Object.freeze(new Point(p.x, p.y));

/** One immutable pointer position and one mutually exclusive editor operation. */
export class PointerInteractionState {
    constructor(pos = undefined, operation = idle) {
        this.pos = pos === undefined ? undefined : freezePoint(point.parse(pos));
        if (!validatedOperations.has(operation)) {
            operation = operationSchema.parse(operation);
            if (operation.offset) operation.offset = freezePoint(operation.offset);
            if (operation.slot) operation.slot = freezePoint(operation.slot);
            if (operation.row) operation.row = Object.freeze({...operation.row, gates: Object.freeze(operation.row.gates)});
            Object.freeze(operation);
            validatedOperations.add(operation);
        }
        this.operation = operation;
        Object.freeze(this);
    }
    get heldGate() { return this.operation.type === 'gate' ? this.operation.gate : undefined; }
    get heldColumn() { return this.operation.type === 'column' ? this.operation.column : undefined; }
    get heldRow() { return this.operation.type === 'row' ? this.operation.row : undefined; }
    get resizingGateSlot() { return this.operation.type === 'resize' ? this.operation.slot : undefined; }
    get selectingWires() { return this.operation.type === 'select-wires' ? this.operation.wire : undefined; }
    get holdOffset() { return this.operation.offset; }
    isHoldingSomething() { return ['gate', 'column', 'row'].includes(this.operation.type); }
    isBusy() { return this.operation.type !== 'idle'; }
    hoverPoints() { return this.pos === undefined || this.isBusy() ? [] : [this.pos]; }
    isEqualTo(other) {
        return this === other || other instanceof PointerInteractionState &&
            equate(this.pos, other.pos) && equate(this.operation, other.operation);
    }
    withPos(pos) {
        return equate(this.pos, pos) ? this : new PointerInteractionState(pos, this.operation);
    }
    withDrop() { return this.isBusy() ? new PointerInteractionState(this.pos) : this; }
    withHeldGate(gate, offset) { return new PointerInteractionState(this.pos, {type: 'gate', gate, offset}); }
    withHeldGateColumn(column, offset) { return new PointerInteractionState(this.pos, {type: 'column', column, offset}); }
    withHeldRow(row, offset) { return new PointerInteractionState(this.pos, {type: 'row', row, offset}); }
    withResizeSlot(slot, offset) { return new PointerInteractionState(this.pos, {type: 'resize', slot, offset}); }
    withSelectingWires(wire) { return new PointerInteractionState(this.pos, {type: 'select-wires', wire}); }
    stableDuration() {
        return this.heldGate?.stableDuration() ?? this.heldColumn?.stableDuration() ??
            (this.heldRow ? new GateColumn(this.heldRow.gates).stableDuration() : Infinity);
    }
}
PointerInteractionState.EMPTY = new PointerInteractionState();
