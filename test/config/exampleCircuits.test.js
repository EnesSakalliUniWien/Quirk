import {Suite, assertThat, assertThrows} from '../TestUtil.js';
import {EXAMPLE_CIRCUITS} from '../../src/config/exampleCircuits.js';
import {CircuitDefinition} from '../../src/circuit/model/CircuitDefinition.js';
import {Serializer} from '../../src/serialization/Serializer.js';

const suite = new Suite('exampleCircuits');

function checkGates(circuit) {
    const gates = [...circuit.customGateSet.gates, ...circuit.columns.flatMap(column => column.gates)];
    for (const gate of gates) {
        if (gate === undefined) continue;
        assertThat(gate.name === 'Parse Error').withInfo({id: gate.serializedId}).isEqualTo(false);
        if (gate.knownCircuit !== undefined) checkGates(gate.knownCircuit);
    }
}

for (const {name, circuit} of EXAMPLE_CIRCUITS) {
    suite.test(`${name} loads all gates and round-trips through the serializer`, () => {
        const loaded = Serializer.fromJson(CircuitDefinition, circuit);
        checkGates(loaded);
        // Deserialization can silently discard gates beyond its wire limit. Check every input cell.
        circuit.cols.forEach((column, col) => column.forEach((gate, row) => {
            if (gate !== 1) {
                assertThat(loaded.columns[col]?.gates[row]?.serializedId).
                    withInfo({col, row}).isEqualTo(typeof gate === 'string' ? gate : gate.id);
            }
        }));
        const json = Serializer.toJson(loaded);
        assertThat(Serializer.toJson(Serializer.fromJson(CircuitDefinition, json))).isEqualTo(json);
    });
}

suite.test('editing a deserialized example leaves the source data unchanged', () => {
    const source = EXAMPLE_CIRCUITS[0].circuit;
    const before = JSON.stringify(EXAMPLE_CIRCUITS);
    assertThrows(() => EXAMPLE_CIRCUITS.push({name: 'changed', circuit: source}));
    assertThrows(() => { EXAMPLE_CIRCUITS[0].name = 'changed'; });
    assertThrows(() => { source.cols[0][0] = 'H'; });
    assertThrows(() => { source.gates[0].circuit.cols[0][0] = 'H'; });
    const loaded = Serializer.fromJson(CircuitDefinition, source);
    loaded.columns[0].gates[0] = undefined;
    assertThat(JSON.stringify(EXAMPLE_CIRCUITS)).isEqualTo(before);
    assertThat(Serializer.fromJson(CircuitDefinition, source).columns[0].gates[0].serializedId).
        isEqualTo(source.cols[0][0]);
});
