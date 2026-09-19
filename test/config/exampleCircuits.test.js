import {Suite, assertThat, assertThrows} from '../TestUtil.js';
import {EXAMPLE_CIRCUITS} from '../../src/config/exampleCircuits.js';
import {CircuitDefinition} from '../../src/circuit/model/CircuitDefinition.js';
import {Serializer} from '../../src/serialization/Serializer.js';
import {CircuitStats} from '../../src/engine/simulation/CircuitStats.js';
import {blochCoordinates} from '../../src/engine/math/bloch.js';
import {Matrix} from '../../src/engine/math/matrix/Matrix.js';

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

suite.testUsingWebGL('Two State Model Unitary from Eigenvalues turns state 0 and 1 about the eigenvector axis', () => {
    const {circuit} = EXAMPLE_CIRCUITS.find(e => e.name === 'Two State Model Unitary from Eigenvalues');
    assertThat(circuit.gates).isEqualTo(undefined);
    const loaded = Serializer.fromJson(CircuitDefinition, circuit);
    // Ry(pi/3) then Rz(pi/4) set the eigenvector axis at polar angle pi/3 and azimuth pi/4. Rz(pi t)
    // gives the eigenvalues e^(∓i pi t/2), and the formula's t runs over 0 to 2 while the time runs over 0 to 1.
    const [theta, phi] = [Math.PI / 3, Math.PI / 4];
    const n = [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
    for (const time of [0, 0.125, 0.3, 0.5, 0.8]) {
        const angle = 2 * Math.PI * time;
        const stats = CircuitStats.fromCircuitAtTime(loaded, time);
        for (const [wire, z] of [[0, 1], [1, -1]]) {
            // Rodrigues' rotation of the pole r = (0, 0, z) about n by the eigenvalue phase difference.
            const cross = [n[1] * z, -n[0] * z, 0];
            const along = n[2] * z * (1 - Math.cos(angle));
            const expected = [0, 1, 2].map(i =>
                (i === 2 ? z : 0) * Math.cos(angle) + cross[i] * Math.sin(angle) + n[i] * along);
            const actual = blochCoordinates(stats.qubitDensityMatrix(Infinity, wire));
            assertThat([actual.x, actual.y, actual.z]).withInfo({time, wire}).isApproximatelyEqualTo(expected, 0.0005);
        }
    }
});

suite.testUsingWebGL('Amplitudes Copied into DAG Children puts each root amplitude where the children repeat their parents', () => {
    const {circuit} = EXAMPLE_CIRCUITS.find(e => e.name === 'Amplitudes Copied into DAG Children');
    assertThat(circuit.gates).isEqualTo(undefined);
    const stats = CircuitStats.fromCircuitAtTime(Serializer.fromJson(CircuitDefinition, circuit), 0);
    // Roots A (wire 0) and B (wire 1) start as Ry(pi/3)|0⟩ and Ry(pi/4)|0⟩. Children C, D and E start empty.
    const a = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
    const b = [Math.cos(Math.PI / 8), Math.sin(Math.PI / 8)];
    const expected = new Array(32).fill(0);
    for (const x of [0, 1]) {
        for (const y of [0, 1]) {
            // Wire 0 is the lowest bit. The edges copy C = A, D = A ⊕ B and E = B.
            expected[x + 2 * y + 4 * x + 8 * (x ^ y) + 16 * y] = a[x] * b[y];
        }
    }
    assertThat(stats.finalState).isApproximatelyEqualTo(Matrix.col(...expected), 0.0005);
});

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
