import {Suite,assertThat} from '../../TestUtil.js';
import {RotationGates} from '../../../src/gates/rotations/RotationGates.js';
import {angleLabelParts} from '../../../src/draw/gate/AngleGateLabel.js';
const suite = new Suite('Angle gate label');
suite.test('display formatting preserves parameter and occupied width', () => {
    const gate = RotationGates.Ry.withParam('3pi/4');
    const before = {param:gate.param,width:gate.width};
    assertThat(angleLabelParts(gate)).isEqualTo({symbol:'Ry',parameter:'3π/4'});
    assertThat({param:gate.param,width:gate.width}).isEqualTo(before);
});
