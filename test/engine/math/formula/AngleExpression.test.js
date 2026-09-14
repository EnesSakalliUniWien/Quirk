import {Suite, assertThat, assertThrows} from '../../../TestUtil.js';
import {parseAngleExpression} from '../../../../src/engine/math/formula/AngleExpression.js';
const suite = new Suite('AngleExpression');
suite.test('angle units include the trigonometric convention', () => {
    assertThat(parseAngleExpression('pi/3').degrees).isApproximatelyEqualTo(60);
    assertThat(parseAngleExpression('60', 'degrees').radians).isApproximatelyEqualTo(Math.PI / 3);
    assertThat(parseAngleExpression('sin(90)', 'degrees').value).isApproximatelyEqualTo(1);
});
suite.test('incomplete nonreal nonfinite and dynamic input is rejected', () => {
    for (const text of ['', 'i', '1/0', 't', 'not_an_angle', 'pi/']) assertThrows(() => parseAngleExpression(text));
});
