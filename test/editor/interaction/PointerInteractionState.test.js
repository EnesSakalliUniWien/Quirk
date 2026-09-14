import {Suite, assertThat, assertThrows} from '../../TestUtil.js';
import {PointerInteractionState} from '../../../src/editor/interaction/PointerInteractionState.js';
import {Point} from '../../../src/geometry/Point.js';
import {Gates} from '../../../src/gates/AllGates.js';

const suite = new Suite('PointerInteractionState');
suite.test('Zod rejects invalid and simultaneous operations', () => {
    const gate = Gates.HalfTurns.H;
    const offset = new Point(0, 0);
    assertThrows(() => new PointerInteractionState(undefined, {type: 'gate', gate, offset, slot: offset}));
    assertThrows(() => new PointerInteractionState(undefined, {type: 'resize', slot: offset}));
    assertThrows(() => new PointerInteractionState(undefined, {type: 'select-wires', wire: -1}));
    assertThrows(() => new PointerInteractionState(undefined, {type: 'column', column: gate, offset}));
});
suite.test('pointer moves reuse validated operation and isolate mutable coordinates', () => {
    const offset = new Point(1, 2);
    const original = PointerInteractionState.EMPTY.withHeldGate(Gates.HalfTurns.H, offset);
    offset.x = 999;
    const moved = original.withPos(new Point(10, 20));
    assertThat(original.holdOffset.x).isEqualTo(1);
    assertThat(original.operation === moved.operation).isEqualTo(true);
    assertThat(moved.withPos(new Point(10, 20)) === moved).isEqualTo(true);
    assertThat(moved.withResizeSlot(new Point(0, 0), new Point(1, 1)).heldGate).isEqualTo(undefined);
    assertThat(moved.withDrop().isBusy()).isEqualTo(false);
});
