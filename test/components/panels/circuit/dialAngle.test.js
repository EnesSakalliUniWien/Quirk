import {Suite, assertThat} from '../../../TestUtil.js';
import {parseAngleExpression, AngleUnit} from '../../../../src/engine/math/formula/AngleExpression.js';
import {radiansExpression, readoutDegrees, readoutRadians, snapAngle, stepAngle}
    from '../../../../src/components/panels/circuit/dialAngle.js';

const suite = new Suite('dialAngle');

suite.test('an angle the dial chose is written as an exact radians formula the gate accepts', () => {
    const cases = [[0, '0'], [90, 'pi/2'], [45, 'pi/4'], [135, '3pi/4'], [180, 'pi'], [360, '2pi'],
        [30, 'pi/6'], [1, 'pi/180'], [37, '37pi/180'], [-90, '-pi/2'], [-135, '-3pi/4'], [540, '3pi'], [22.5, '22.5pi/180']];
    for (const [degrees, expected] of cases) {
        assertThat(radiansExpression(degrees)).withInfo({degrees}).isEqualTo(expected);
        assertThat(parseAngleExpression(expected, AngleUnit.RADIANS).degrees).withInfo({degrees}).isApproximatelyEqualTo(degrees);
    }
});

suite.test('the readouts are short', () => {
    assertThat(readoutDegrees(90)).isEqualTo('90°');
    assertThat(readoutDegrees(90.04)).isEqualTo('90°');
    assertThat(readoutDegrees(90.25)).isEqualTo('90.3°');
    assertThat(readoutRadians(90)).isEqualTo('π/2');
    assertThat(readoutRadians(135)).isEqualTo('3π/4');
});

suite.test('a turn goes to the next notch or detent in its direction, and a drag snaps to them', () => {
    assertThat(stepAngle(90, +1, false)).isEqualTo(91);
    assertThat(stepAngle(90, -1, false)).isEqualTo(89);
    assertThat(stepAngle(90, +1, true)).isEqualTo(105);
    assertThat(stepAngle(90, -1, true)).isEqualTo(75);
    // From between two stops, the nearest stop in the turn's own direction.
    assertThat(stepAngle(92, +1, true)).isEqualTo(105);
    assertThat(stepAngle(92, -1, true)).isEqualTo(90);
    assertThat(stepAngle(90.4, +1, false)).isEqualTo(91);
    assertThat(stepAngle(90.4, -1, false)).isEqualTo(90);
    assertThat(snapAngle(92, 15)).isEqualTo(90);
    assertThat(snapAngle(98, 15)).isEqualTo(105);
    assertThat(snapAngle(90.6, 1)).isEqualTo(91);
});
