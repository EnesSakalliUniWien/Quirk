import {Suite, assertThat} from '../../../TestUtil.js';
import {Serializer} from '../../../../src/serialization/Serializer.js';
import {CircuitDefinition} from '../../../../src/circuit/model/CircuitDefinition.js';
import {Registers} from '../../../../src/circuit/model/Registers.js';
import {MAX_ROWS, stepStops, stepTables} from '../../../../src/components/panels/probabilities/stepTables.js';
import {describeColumn} from '../../../../src/engine/simulation/stepAlgebra.js';

const suite = new Suite('ProbabilityStepTables');

const circuit = cols => Serializer.fromJson(CircuitDefinition, {cols});
const summary = tables => tables.map(({title, largest, hidden, rows}) =>
    ({title, largest, hidden, rows: rows.map(({ket, values}) => [ket, ...values.map(v => Math.round(v * 1000) / 1000)])}));

suite.test('the steps are the transport stops: the start, then after each column that operates', () => {
    // The empty column and the trailing display are not steps; the last step takes the display in.
    const c = circuit([['H'], [], ['•', 'X'], ['Chance2']]);
    assertThat(stepStops(c)).isEqualTo([
        {column: 0, label: 'Start', description: 'The input state, before any column'},
        {column: 1, label: 'H', description: describeColumn(c.columns[0], c.registers)},
        {column: 4, label: '• X', description: describeColumn(c.columns[2], c.registers)},
    ]);
});

suite.test('each cell knows whether its step raised, lowered or kept the chance', () => {
    const steps = [[1, 0, 0, 0], [0.5, 0.5, 0, 0], [0.5, 0, 0, 0.5]].map(p => Float64Array.from(p));
    const [only] = stepTables(steps, 'index', 2, Registers.EMPTY);
    assertThat(only.rows.map(row => row.changes)).isEqualTo([
        [undefined, -1, 0],
        [undefined, 1, -1],
        [undefined, 0, 0],
        [undefined, 0, 1],
    ]);
});

suite.test('one table holds every outcome after every step, on one scale', () => {
    // |00>, then H on q0, then a CNOT making a Bell pair.
    const steps = [[1, 0, 0, 0], [0.5, 0.5, 0, 0], [0.5, 0, 0, 0.5]].map(p => Float64Array.from(p));
    assertThat(summary(stepTables(steps, 'index', 2, Registers.EMPTY))).isEqualTo([{
        title: undefined, largest: 1, hidden: 0, rows: [
            ['00', 1, 0.5, 0.5],
            ['01', 0, 0.5, 0],
            ['10', 0, 0, 0],
            ['11', 0, 0, 0.5],
        ],
    }]);
});

suite.test('grouped tables keep wires together that any step correlates, and split off the rest', () => {
    // q0 q1 become a Bell pair at the last step; q2 is a fair coin throughout.
    const steps = [
        [0.5, 0, 0, 0, 0.5, 0, 0, 0],
        [0.25, 0.25, 0, 0, 0.25, 0.25, 0, 0],
        [0.25, 0, 0, 0.25, 0.25, 0, 0, 0.25],
    ].map(p => Float64Array.from(p));
    assertThat(summary(stepTables(steps, 'grouped', 3, Registers.EMPTY))).isEqualTo([
        {title: 'q1 q0 · correlated', largest: 1, hidden: 0, rows: [
            ['00', 1, 0.5, 0.5], ['01', 0, 0.5, 0], ['10', 0, 0, 0], ['11', 0, 0, 0.5]]},
        {title: 'q2 · independent', largest: 0.5, hidden: 0, rows: [['0', 0.5, 0.5, 0.5], ['1', 0.5, 0.5, 0.5]]},
    ]);
});

suite.test('a large table keeps the outcomes some step allows, likeliest first, in index order', () => {
    const before = new Float64Array(256);
    before[0] = 1;
    const after = new Float64Array(256);
    after[0] = 0.5;
    after[200] = 0.3;
    after[3] = 0.2;
    const [only] = stepTables([before, after], 'index', 8, Registers.EMPTY);
    assertThat(only.rows.map(row => row.index)).isEqualTo([0, 3, 200]);
    assertThat(only.hidden).isEqualTo(253);
    assertThat(MAX_ROWS).isEqualTo(32);
});
