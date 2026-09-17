import {Suite, assertThat} from '../../../TestUtil.js';
import {anglesOf, easeInOut, glidesBetween, panelReadout, subtitleFor} from '../../../../src/components/panels/bloch/analyzerModel.js';

const suite = new Suite('BlochAnalyzerModel');

suite.test('the arrow glides when the state shown changes at once, and follows a running circuit directly', () => {
    const target = {row: 0, col: 1};
    const circuit = {isEqualTo: other => other === circuit || other === sameCircuit};
    const sameCircuit = {isEqualTo: other => other === circuit || other === sameCircuit};
    const edited = {isEqualTo: () => false};
    const source = (kind, index = undefined, of = circuit, on = target) => ({target: on, kind, index, circuit: of});

    // Another step, back to the circuit, or an edit: glide.
    assertThat(glidesBetween(source('circuit'), source('step', 0))).isEqualTo(true);
    assertThat(glidesBetween(source('step', 0), source('step', 2))).isEqualTo(true);
    assertThat(glidesBetween(source('explore'), source('circuit'))).isEqualTo(true);
    assertThat(glidesBetween(source('circuit'), source('circuit', undefined, edited))).isEqualTo(true);
    // The same state source a frame later, a move into a free state, a first frame or another sphere: no glide.
    assertThat(glidesBetween(source('circuit'), source('circuit', undefined, sameCircuit))).isEqualTo(false);
    assertThat(glidesBetween(source('circuit'), source('explore'))).isEqualTo(false);
    assertThat(glidesBetween(undefined, source('circuit'))).isEqualTo(false);
    assertThat(glidesBetween(source('circuit'), source('step', 1, circuit, {row: 1, col: 1}))).isEqualTo(false);

    assertThat([easeInOut(0), easeInOut(0.5), easeInOut(1)]).isEqualTo([0, 0.5, 1]);
});

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
