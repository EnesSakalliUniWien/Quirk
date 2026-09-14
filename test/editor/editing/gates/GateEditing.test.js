import {Suite, assertThat} from '../../../TestUtil.js';
import {CircuitViewState} from '../../../../src/editor/state/CircuitViewState.js';
import {PointerInteractionState} from '../../../../src/editor/interaction/PointerInteractionState.js';
import {CircuitDefinition} from '../../../../src/circuit/model/CircuitDefinition.js';
import {GateColumn} from '../../../../src/circuit/model/GateColumn.js';
import {Gate} from '../../../../src/circuit/model/Gate.js';
import {Gates} from '../../../../src/gates/AllGates.js';
import {Point} from '../../../../src/geometry/Point.js';
import {Layout} from '../../../../src/config/Layout.js';

const suite = new Suite('GateEditing');

suite.test('duplicate and alternate grabs preserve the original while ordinary grabs remove it', () => {
    const gate = Gates.QuarterTurns.SqrtZForward;
    const circuit = CircuitViewState.empty(0).withCircuit(new CircuitDefinition(2, [new GateColumn([gate, undefined])]));
    const hand = PointerInteractionState.EMPTY.withPos(circuit.gateRect(0,0).center());
    const copy = circuit.tryGrab(hand, true, false, false, true);
    assertThat(copy.newCircuit.circuitDefinition.gateInSlot(0,0)).isEqualTo(gate);
    assertThat(copy.newHand.heldGate).isEqualTo(gate.alternate);
    const moved = circuit.tryGrab(hand);
    assertThat(moved.newCircuit.circuitDefinition.gateInSlot(0,0)).isEqualTo(undefined);
    assertThat(moved.newHand.heldGate).isEqualTo(gate);
    assertThat(circuit.circuitDefinition.gateInSlot(0,0)).isEqualTo(gate);
});

suite.test('resizing keeps the first family member on a tie and selects the nearer height otherwise', () => {
    const family = Gate.buildFamily(1,2,(span,builder) => builder.setHeight(2 * span - 1));
    const circuit = CircuitViewState.empty(0).withCircuit(new CircuitDefinition(4,[new GateColumn([family.all[0], undefined, undefined, undefined])]));
    const hand = PointerInteractionState.EMPTY.withResizeSlot(new Point(0,0),new Point(0,0));
    const tie = circuit.previewDrop(hand.withPos(new Point(0,1.5 * Layout.WIRE_SPACING)));
    assertThat(tie.circuitDefinition.gateInSlot(0,0)).isEqualTo(family.all[0]);
    const taller = circuit.previewDrop(hand.withPos(new Point(0,2.5 * Layout.WIRE_SPACING)));
    assertThat(taller.circuitDefinition.gateInSlot(0,0)).isEqualTo(family.all[1]);
});
