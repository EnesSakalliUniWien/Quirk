import {Suite, assertThat} from '../../../TestUtil.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {independentBlocks, independentGroups} from '../../../../src/draw/displays/probability/ProbabilityBlocks.js';

const suite = new Suite('ProbabilityBlocks');

/** The distribution over wires given as per-block distributions, top block first. */
function product(...parts) {
    let joint = [1];
    let bits = 0;
    for (const part of parts) {
        joint = part.flatMap(p => joint.map(q => p * q));
        bits += Math.log2(part.length);
    }
    return {matrix: Matrix.col(...joint), bits};
}

const summary = blocks => blocks.map(({start, length, probabilities}) =>
    [start, length, [...probabilities.rawBuffer()].filter((_, i) => i % 2 === 0).map(p => Math.round(p * 1000) / 1000)]);

suite.test('independent wires come apart into blocks beside their wires', () => {
    // A Bell pair on the top two wires, then a fair coin, then a 90/10 wire.
    const {matrix, bits} = product([0.5, 0, 0, 0.5], [0.5, 0.5], [0.9, 0.1]);
    assertThat(summary(independentBlocks(matrix, bits))).isEqualTo([
        [0, 2, [0.5, 0, 0, 0.5]],
        [2, 1, [0.5, 0.5]],
        [3, 1, [0.9, 0.1]],
    ]);
});

suite.test('correlated wires stay one block, including correlations no pair of wires shows', () => {
    const bell = Matrix.col(0.5, 0, 0, 0.5);
    const blocks = independentBlocks(bell, 2);
    assertThat(blocks.length).isEqualTo(1);
    assertThat(blocks[0].probabilities).isEqualTo(bell);
    // Even parity over three wires: every pair looks independent, the three together do not.
    const parity = Matrix.col(...[...Array(8).keys()].map(i => (i ^ (i >> 1) ^ (i >> 2)) & 1 ? 0 : 0.25));
    assertThat(independentBlocks(parity, 3).length).isEqualTo(1);
});

suite.test('round-off does not merge blocks, and a real correlation does', () => {
    const noisy = product([0.5, 0.5], [0.25, 0.75]).matrix;
    noisy.rawBuffer()[0] += 1e-9;
    assertThat(independentBlocks(noisy, 2).length).isEqualTo(2);
    const correlated = Matrix.col(0.125 + 1e-4, 0.375 - 1e-4, 0.125 - 1e-4, 0.375 + 1e-4);
    assertThat(independentBlocks(correlated, 2).length).isEqualTo(1);
    // A uniform distribution is every wire on its own.
    assertThat(independentBlocks(Matrix.generate(1, 256, () => 1 / 256), 8).length).isEqualTo(8);
});

const groupSummary = groups => groups.map(({wires, probabilities}) =>
    [wires, [...probabilities.rawBuffer()].filter((_, i) => i % 2 === 0).map(p => Math.round(p * 1000) / 1000)]);

suite.test('independent groups need not be adjacent', () => {
    // A Bell pair on q0 and q2, with a 90/10 wire between them.
    const joint = Matrix.col(...[...Array(8).keys()].map(i =>
        ((i & 1) === ((i >> 2) & 1) ? 0.5 : 0) * [0.9, 0.1][(i >> 1) & 1]));
    assertThat(groupSummary(independentGroups(joint, 3))).isEqualTo([
        [[0, 2], [0.5, 0, 0, 0.5]],
        [[1], [0.9, 0.1]],
    ]);
});

suite.test('a correlation no pair of wires shows keeps its wires in one group, apart from independent ones', () => {
    // Even parity over q0 q1 q2, and a fair coin on q3.
    const joint = Matrix.col(...[...Array(16).keys()].map(i =>
        ((i ^ (i >> 1) ^ (i >> 2)) & 1 ? 0 : 0.25) * 0.5));
    assertThat(groupSummary(independentGroups(joint, 4)).map(([wires]) => wires)).isEqualTo([[0, 1, 2], [3]]);
    // Every wire of a uniform distribution is a group of its own; a Bell pair is one group.
    assertThat(independentGroups(Matrix.generate(1, 64, () => 1 / 64), 6).length).isEqualTo(6);
    assertThat(groupSummary(independentGroups(Matrix.col(0.5, 0, 0, 0.5), 2))).isEqualTo([[[0, 1], [0.5, 0, 0, 0.5]]]);
});
