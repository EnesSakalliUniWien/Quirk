import {Suite, assertThat} from '../../../TestUtil.js';
import {anglesOf, panelReadout, subtitleFor} from '../../../../src/components/panels/bloch/analyzerModel.js';

const suite = new Suite('BlochAnalyzerModel');

suite.test('the subtitle says whose state is shown, and from where', () => {
    const gate = {row: 0, col: 1};
    const output = {row: 2, col: undefined};
    assertThat(subtitleFor({kind: 'circuit'}, gate)).isEqualTo('Qubit 1 · at column 2');
    assertThat(subtitleFor({kind: 'circuit'}, output)).isEqualTo('Qubit 3 · final output state');
    assertThat(subtitleFor({kind: 'step', index: 0}, gate)).isEqualTo('Qubit 1 · before the first column');
    assertThat(subtitleFor({kind: 'step', index: 2}, gate)).isEqualTo('Qubit 1 · after column 2');
    assertThat(subtitleFor({kind: 'explore', vec: {x: 0, y: 0, z: 1}, preset: undefined}, gate))
        .isEqualTo('Exploring a free state — not from the circuit');
    assertThat(subtitleFor({kind: 'circuit'}, undefined)).isEqualTo('Click a Bloch sphere in the circuit.');
});

suite.test('the readout names the ket, and holds the angles the controls show', () => {
    const plus = panelReadout({x: 1, y: 0, z: 0});
    assertThat(plus.state).isEqualTo('0.707 |0⟩ + (+0.707+0.000i) |1⟩');
    assertThat([plus.thetaDegrees, plus.phiDegrees]).isApproximatelyEqualTo([90, 0]);
    assertThat(panelReadout({x: 0, y: -1, z: 0}).phiDegrees).isApproximatelyEqualTo(270);
    assertThat(panelReadout({x: 0, y: 0, z: 0}).state).isEqualTo('Maximally mixed — no Bloch direction defined');
    assertThat(panelReadout({x: 0.3, y: 0, z: 0}).state).isEqualTo('mixed — |r| < 1 (entangled or decohered)');
});

suite.test('an angle the state lacks leaves its control empty', () => {
    assertThat(anglesOf(null)).isEqualTo({theta: 0, phi: 0, thetaDefined: false, phiDefined: false});
    assertThat(anglesOf(panelReadout({x: 0, y: 0, z: -1}))).isEqualTo(
        {theta: 180, phi: 0, thetaDefined: true, phiDefined: false});
    assertThat(anglesOf(panelReadout({x: 0, y: 0, z: 0}))).isEqualTo(
        {theta: 0, phi: 0, thetaDefined: false, phiDefined: false});
});
