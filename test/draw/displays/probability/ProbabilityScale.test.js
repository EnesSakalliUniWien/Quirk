import {Suite, assertThat} from '../../../TestUtil.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {ZERO_PROBABILITY, formatProbability, largestProbability, probabilityBarFraction}
    from '../../../../src/draw/displays/probability/ProbabilityScale.js';

const suite = new Suite('ProbabilityScale');

suite.test('a percentage keeps an impossible outcome apart from a tiny chance', () => {
    assertThat(formatProbability(0)).isEqualTo('0%');
    assertThat(formatProbability(ZERO_PROBABILITY)).isEqualTo('0%');
    assertThat(formatProbability(1e-14)).isEqualTo('0%');
    assertThat(formatProbability(1e-4)).isEqualTo('<0.1%');
    assertThat(formatProbability(0.0006)).isEqualTo('0.1%');
    assertThat(formatProbability(0.489)).isEqualTo('48.9%');
    assertThat(formatProbability(0.9996)).isEqualTo('>99.9%');
    assertThat(formatProbability(1 - 1e-14)).isEqualTo('100%');
    // Single precision's nearest value below one is still certainty.
    assertThat(formatProbability(Math.fround(0.99999994))).isEqualTo('100%');
    assertThat(formatProbability(0.99999)).isEqualTo('>99.9%');
    assertThat(formatProbability(1e-4, 4)).isEqualTo('0.0100%');
    assertThat(formatProbability(NaN)).isEqualTo('NaN');
});

suite.test('a bar is the square root of its share of the largest probability', () => {
    assertThat(probabilityBarFraction(0.16, 0.16)).isEqualTo(1);
    assertThat(probabilityBarFraction(0.01, 0.16)).isEqualTo(0.25);
    assertThat(probabilityBarFraction(0.04, 0.16)).isEqualTo(0.5);
    // Round-off where nothing can happen draws no bar, and nothing is longer than full.
    assertThat(probabilityBarFraction(1e-14, 0.16)).isEqualTo(0);
    assertThat(probabilityBarFraction(0.5, 0.25)).isEqualTo(1);
    assertThat(probabilityBarFraction(0.5, 0)).isEqualTo(0);
    assertThat(largestProbability(Matrix.col(0.25, 0.5, 0, 0.25))).isEqualTo(0.5);
});
