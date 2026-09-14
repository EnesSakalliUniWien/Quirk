import {Suite, assertThat} from '../../../TestUtil.js';
import {CircuitViewState} from '../../../../src/editor/state/CircuitViewState.js';
import {PointerInteractionState} from '../../../../src/editor/interaction/PointerInteractionState.js';
import {CircuitDefinition} from '../../../../src/circuit/model/CircuitDefinition.js';
import {GateColumn} from '../../../../src/circuit/model/GateColumn.js';
import {Registers} from '../../../../src/circuit/model/Registers.js';
import {Gates} from '../../../../src/gates/AllGates.js';
import {Simulation} from '../../../../src/config/Simulation.js';

const suite = new Suite('WireEditing');

suite.test('moving a row carries its gates and initial state and updates register boundaries', () => {
    const {H,X,Z} = Gates.HalfTurns;
    const definition = new CircuitDefinition(4,[new GateColumn([H,X,Z,undefined])])
        .withInitialStates(new Map([[0,'+'],[1,'1']]))
        .withRegisters(new Registers([{name:'a',start:0,length:3,input:undefined}]));
    const circuit = CircuitViewState.empty(0).withCircuit(definition);
    const grabbed = circuit.tryGrab(PointerInteractionState.EMPTY.withPos(circuit.geometry().wireInitialStateRect(1).center()),false,true);
    const moved = grabbed.newCircuit.afterDropping(grabbed.newHand.withPos(circuit.geometry().wireInitialStateRect(2).center()));
    const result = moved.circuitDefinition;
    assertThat([0,1,2].map(row => result.gateInSlot(0,row))).isEqualTo([H,Z,X]);
    assertThat(result.customInitialValues).isEqualTo(new Map([[0,'+'],[2,'1']]));
    assertThat(result.registers.at(0).length).isEqualTo(2);
    assertThat(result.registers.at(2)).isEqualTo(undefined);
    assertThat(definition.registers.at(0).length).isEqualTo(3);
});

suite.test('temporary wires respect both limits and disappear when editing ends', () => {
    const empty = CircuitViewState.empty(0);
    const expanded = empty.withJustEnoughWires(1);
    assertThat(expanded.circuitDefinition.numWires).isEqualTo(Simulation.MIN_WIRE_COUNT + 1);
    assertThat(expanded.withJustEnoughWires(0).circuitDefinition.numWires).isEqualTo(Simulation.MIN_WIRE_COUNT);
    const gate = Gates.FourierTransformGates.FourierTransformFamily.ofSize(Simulation.MAX_WIRE_COUNT);
    const full = empty.withCircuit(new CircuitDefinition(Simulation.MAX_WIRE_COUNT,[new GateColumn(Array.from({length:Simulation.MAX_WIRE_COUNT}, (_,row) => row === 0 ? gate : undefined))]));
    assertThat(full.withJustEnoughWires(1).circuitDefinition.numWires).isEqualTo(Simulation.MAX_WIRE_COUNT);
});
