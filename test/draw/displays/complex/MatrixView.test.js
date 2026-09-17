/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Suite, assertThat} from '../../../TestUtil.js';
import {DisplayView} from '../../scene/TestDisplayView.js';
import {Color} from 'pixi.js';
import {drawsAsPixels, paintMatrix} from '../../../../src/draw/displays/complex/MatrixView.js';
import {traceAmplitudeLogarithmCircle, traceAmplitudePhaseDirection} from '../../../../src/draw/displays/complex/ComplexCellGeometry.js';
import {Rect} from '../../../../src/geometry/Rect.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {CanvasTheme, phaseColor} from '../../../../src/config/CanvasTheme.js';
const suite = new Suite('MatrixView');

suite.test("phaseMapping_ignoresZeroEntriesAndCanSuppressUndefinedLocalPhase", async () => {
    const painter = new DisplayView(document.createElement('canvas'));
    const phases = [];
    paintMatrix(painter, Matrix.fromRows([[0, 1], [-1, 0]]), new Rect(0, 0, 80, 80), {
        amplitudeCircleFillColor: CanvasTheme.amplitude.circle,
        amplitudeCircleStrokeColor: CanvasTheme.text.primary,
        amplitudeProbabilityFillColor: CanvasTheme.amplitude.fill,
        backColor: CanvasTheme.amplitude.background,
        phaseColorForDegrees: angle => { phases.push(angle); return phaseColor(angle); }
    });
    assertThat(phases).isEqualTo([0, 180]);

    painter.begin();
    paintMatrix(painter, Matrix.fromRows([[1]]), new Rect(0, 0, 40, 40), {
        amplitudeCircleStrokeColor: CanvasTheme.text.primary,
        backColor: CanvasTheme.amplitude.background,
        phaseColorForDegrees: () => undefined
    });
    // Only the grid halo and grid stroke remain; no false phase is drawn for incoherent data.
    await painter.commit();
    const strokes = painter.children.flatMap(child => child.context?.instructions || [])
        .filter(i => i.action === 'stroke').map(i => i.data.style.color);
    assertThat(strokes).isEqualTo([CanvasTheme.amplitude.phaseHalo, CanvasTheme.stroke.grid].map(c => new Color(c).toNumber()));
});


suite.test('retainsGeometryAndInvalidatesMutableValuesLayoutAndOptions', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    const matrix = Matrix.fromRows([[1]]);
    const options = {amplitudeCircleFillColor: CanvasTheme.amplitude.circle,
        amplitudeCircleStrokeColor: CanvasTheme.text.primary};
    const draw = async (data = matrix, rect = new Rect(0, 0, 40, 40), style = options) => {
        view.begin();
        paintMatrix(view, data, rect, style);
        await view.commit();
        return view.children[0];
    };
    const graphic = await draw();
    const first = graphic.context.instructions[0];
    await draw(Matrix.fromRows([[1]]));
    assertThat(view.children[0] === graphic).isEqualTo(true);
    assertThat(graphic.context.instructions[0] === first).isEqualTo(true);
    matrix.rawBuffer()[0] = 0.5;
    await draw();
    assertThat(graphic.context.instructions[0] === first).isEqualTo(false);
    const mutated = graphic.context.instructions[0];
    await draw(matrix, new Rect(10, 0, 40, 40));
    assertThat(graphic.context.instructions[0] === mutated).isEqualTo(false);
    const moved = graphic.context.instructions[0];
    await draw(matrix, new Rect(10, 0, 40, 40), {...options, showLogCircles: false});
    assertThat(graphic.context.instructions[0] === moved).isEqualTo(false);
    const strokes = graphic.context.instructions.filter(i => i.action === 'stroke');
    assertThat(strokes.at(-1).data.style.width).isEqualTo(2);
    await draw(matrix, new Rect(10, 0, 40, 40), {...options, showPhase: false});
    assertThat(graphic.context.instructions.filter(i => i.action === 'stroke').at(-1).data.style.color)
        .isEqualTo(new Color(CanvasTheme.stroke.grid).toNumber());
});

suite.test('past five qubits, cells too small for discs, rings and hands are drawn as pixels', () => {
    // A twelve-qubit output grid keeps its marks; thirteen and fourteen qubits switch to pixels.
    assertThat(drawsAsPixels(64, 64, new Rect(0, 0, 1272, 1272))).isEqualTo(false);
    assertThat(drawsAsPixels(64, 128, new Rect(0, 0, 692, 1384))).isEqualTo(true);
    assertThat(drawsAsPixels(128, 128, new Rect(0, 0, 1496, 1496))).isEqualTo(true);
    // Up to five qubits always keep their marks.
    assertThat(drawsAsPixels(32, 32, new Rect(0, 0, 100, 100))).isEqualTo(false);
});

suite.test('phase hands end on the logarithmic ring they are read against', () => {
    const d = 40;
    for (const [real, imag] of [[0.25, 0], [0, -0.5], [0.6, 0.8], [0.01, 0.02]]) {
        let ring;
        traceAmplitudeLogarithmCircle({circle: (x, y, r) => { ring = r; }}, real, imag, 0, 0, d);
        let tip;
        const path = {moveTo: () => path, lineTo: (x, y) => { tip = Math.hypot(x - d / 2, y - d / 2); return path; }};
        traceAmplitudePhaseDirection(path, real, imag, 0, 0, d);
        assertThat(tip).withInfo({real, imag}).isApproximatelyEqualTo(ring);
    }
});

suite.test('logarithmic rings stay on cells down to twelve units', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    const ring = new Color(CanvasTheme.stroke.logRing);
    const ringsAt = async size => {
        view.begin();
        paintMatrix(view, Matrix.fromRows([[0.5, 0.5], [0.5, -0.5]]), new Rect(0, 0, size, size), {
            amplitudeCircleFillColor: CanvasTheme.amplitude.circle, amplitudeCircleStrokeColor: CanvasTheme.text.primary});
        await view.commit();
        return view.children[0].context.instructions.some(i => i.action === 'stroke' &&
            i.data.style.color === ring.toNumber() && Math.abs(i.data.style.alpha - ring.alpha) < 0.01);
    };
    assertThat(await ringsAt(28)).isEqualTo(true);
    assertThat(await ringsAt(20)).isEqualTo(false);
});
