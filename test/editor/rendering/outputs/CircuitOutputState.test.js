import {Suite, assertThat} from '../../../TestUtil.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {outputStateAsMatrix} from '../../../../src/editor/rendering/outputs/CircuitOutputState.js';

const suite = new Suite('CircuitOutputState');

suite.test('display adaptation preserves amplitude ordering and omits temporary wires without altering simulation data', () => {
    const values = Float32Array.from({length: 32}, (_, i) => i / 32);
    const stats = {circuitDefinition: {numWires: 4}, finalState: new Matrix(1, 16, values)};
    const all = outputStateAsMatrix(stats, 4);
    const reduced = outputStateAsMatrix(stats, 3);
    assertThat([all.width(), all.height()]).isEqualTo([4, 4]);
    assertThat([reduced.width(), reduced.height()]).isEqualTo([2, 4]);
    assertThat([...reduced.rawBuffer()]).isEqualTo([...values.slice(0, 16)]);
    assertThat([...stats.finalState.rawBuffer()]).isEqualTo([...values]);
});
