import {Suite, assertThat} from '../../TestUtil.js';
import {phaseReferenceIndex, withPhaseReference} from '../../../src/engine/math/phaseReference.js';

const suite = new Suite('phaseReference');

suite.test('phases are measured from the largest amplitude, the first of any that tie', () => {
    // 0.6|0⟩ + 0.8i|1⟩: the second is larger.
    assertThat(phaseReferenceIndex([0.6, 0, 0, 0.8])).isEqualTo(1);
    // A uniform state is read from |0…0⟩.
    const h = Math.SQRT1_2;
    assertThat(phaseReferenceIndex([h, 0, -h, 0])).isEqualTo(0);
    assertThat(phaseReferenceIndex([0, 0, 0, 0])).isEqualTo(undefined);
    assertThat(phaseReferenceIndex([NaN, 0, 1, 0])).isEqualTo(undefined);
});

suite.test('measuring from a reference turns every amplitude together, keeping sizes and differences', () => {
    // −|11⟩ from Y·Y is the same state as |11⟩ from X·X, and reads as it once measured from itself.
    assertThat([...withPhaseReference([0, 0, 0, 0, 0, 0, -1, 0], 3)]).isApproximatelyEqualTo([0, 0, 0, 0, 0, 0, 1, 0]);
    // (|0⟩ + i|1⟩)/√2 measured from |0⟩ keeps |1⟩ a quarter turn ahead.
    const h = Math.SQRT1_2;
    const turned = withPhaseReference([0, h, -h, 0], 0);
    assertThat([...turned]).isApproximatelyEqualTo([h, 0, 0, h]);
});
