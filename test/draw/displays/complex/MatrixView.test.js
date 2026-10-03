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

import {Suite, assertThat, assertTrue} from '../../../TestUtil.js';
import {DisplayView} from '../../scene/TestDisplayView.js';
import {Color} from 'pixi.js';
import {drawsAsPixels, paintMatrix} from '../../../../src/draw/displays/complex/MatrixView.js';
import {chanceGauge, discRadius, handLength, logRingRadius} from '../../../../src/draw/displays/complex/ComplexCellGeometry.js';
import {Rect} from '../../../../src/geometry/Rect.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {CanvasTheme, phaseTint} from '../../../../src/config/CanvasTheme.js';
const suite = new Suite('MatrixView');

/** The matrix's Pixi container, after drawing `matrix` into `rect` with `options`. */
async function cells(matrix, rect = new Rect(0, 0, 80, 80), options = {}, view = new DisplayView(document.createElement('canvas'))) {
    view.begin();
    paintMatrix(view, matrix, rect, options);
    await view.commit();
    return {view, grid: view.children[0]};
}

suite.test('colour means phase: each disc wears its phase hue, and every other mark is a neutral ink', async () => {
    // +1, −1, +i and −i: blue, orange, magenta and green on the wheel.
    const {grid} = await cells(new Matrix(2, 2, new Float32Array([1, 0, -1, 0, 0, 1, 0, -1]).map(v => v / 2)), new Rect(0, 0, 80, 80),
        {showChance: true});
    const [discs, rings, rails, gauges, ticks, hands] = grid.kinds;
    assertThat(discs.map(d => d.tint)).isEqualTo([0, 180, 90, -90].map(degrees => phaseTint(degrees)));
    const neutral = color => new Color(color).toNumber();
    assertTrue(hands.every(h => h.tint === neutral(CanvasTheme.amplitude.hand)));
    assertTrue(gauges.every(g => g.tint === neutral(CanvasTheme.amplitude.chance)));
    assertTrue(rings.every(r => r.tint === neutral(CanvasTheme.stroke.logRing)));
    assertTrue(rails.every(r => r.tint === neutral(CanvasTheme.probability.track)));
    assertTrue(ticks.every(t => t.tint === neutral(CanvasTheme.stroke.guide)));
    // The hands point along the phases, counter-clockwise on screen.
    assertThat(hands.map(h => h.rotation)).isApproximatelyEqualTo([0, -Math.PI, -Math.PI / 2, Math.PI / 2]);
});

suite.test('a zero entry draws nothing, and undefined phases leave the discs without a hue or a hand', async () => {
    const {grid} = await cells(Matrix.fromRows([[0, 1]]), new Rect(0, 0, 80, 40), {showChance: true});
    const [discs, , , gauges, , hands] = grid.kinds;
    assertThat([discs[0].alpha, gauges[0].alpha, hands[0].alpha]).isEqualTo([0, 0, 0]);
    assertThat([discs[1].alpha, gauges[1].alpha, hands[1].alpha]).isEqualTo([1, 1, 1]);
    const incoherent = (await cells(Matrix.fromRows([[0, 1]]), new Rect(0, 0, 80, 40), {phaseAlpha: 0})).grid;
    assertThat(incoherent.kinds[0][1].tint).isEqualTo(new Color(CanvasTheme.amplitude.unknown).toNumber());
    assertThat(incoherent.kinds[5][1].alpha).isEqualTo(0);
});

suite.test('the same numbers draw nothing again, and a changed number moves marks rather than rebuilding', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    const matrix = Matrix.fromRows([[1]]);
    const {grid} = await cells(matrix, new Rect(0, 0, 40, 40), {}, view);
    const ground = grid.ground.context.instructions.slice();
    const disc = grid.kinds[0][0];
    await cells(Matrix.fromRows([[1]]), new Rect(0, 0, 40, 40), {}, view);
    assertThat(view.children[0] === grid).isEqualTo(true);
    matrix.rawBuffer()[0] = 0.5;
    await cells(matrix, new Rect(0, 0, 40, 40), {}, view);
    // The same particle, smaller; the grid's ground was not redrawn.
    assertThat(grid.kinds[0][0] === disc).isEqualTo(true);
    assertThat(disc.scaleX).isApproximatelyEqualTo(discRadius(0.5, 0, 40) / 250);
    assertThat(grid.ground.context.instructions.length).isEqualTo(ground.length);
});

suite.test('past five qubits, cells too small for discs, rings and hands are drawn as pixels', async () => {
    // A twelve-qubit output grid keeps its marks; thirteen and fourteen qubits switch to pixels.
    assertThat(drawsAsPixels(64, 64, new Rect(0, 0, 1272, 1272))).isEqualTo(false);
    assertThat(drawsAsPixels(64, 128, new Rect(0, 0, 692, 1384))).isEqualTo(true);
    assertThat(drawsAsPixels(128, 128, new Rect(0, 0, 1496, 1496))).isEqualTo(true);
    // Up to five qubits always keep their marks.
    assertThat(drawsAsPixels(32, 32, new Rect(0, 0, 100, 100))).isEqualTo(false);
    // As pixels, the grid is one texture and no marks.
    const {grid} = await cells(Matrix.generate(64, 128, () => 1 / 90), new Rect(0, 0, 692, 1384), {wireCount: 13});
    assertThat(grid.pixelSprite?.visible).isEqualTo(true);
    assertThat(grid.marks.visible).isEqualTo(false);
});

suite.test('a phase hand is as long as its amplitude, ending on its disc, with a short least length', () => {
    const d = 40;
    for (const [real, imag] of [[0.25, 0], [0, -0.5], [0.6, 0.8]]) {
        assertThat(handLength(real, imag, d)).withInfo({real, imag}).isApproximatelyEqualTo(discRadius(real, imag, d));
    }
    // A small amplitude still shows which way its phase points.
    assertThat(handLength(0.01, 0.02, d)).isEqualTo(4);
    assertThat(handLength(0, 0, d)).isEqualTo(0);
});

suite.test('logarithmic rings stay on cells down to twelve units', async () => {
    const ringsAt = async size => (await cells(Matrix.fromRows([[0.5, 0.5], [0.5, -0.5]]), new Rect(0, 0, size, size)))
        .grid.kinds[1].some(ring => ring.alpha > 0);
    assertThat(await ringsAt(28)).isEqualTo(true);
    assertThat(await ringsAt(20)).isEqualTo(false);
    // The ring shrinks a fifteenth of the half-cell per factor of e, and is gone below e^-15.
    assertThat(logRingRadius(1, 0, 40)).isApproximatelyEqualTo(20);
    assertThat(logRingRadius(Math.exp(-15 / 2) / 2, 0, 40)).isEqualTo(0);
});

suite.test("an amplitude's chance gauge stands inside the grid's lines and keeps a sliver when small", () => {
    const d = 60;
    // A chance of one fills the rail, which stops short of the cell's top and bottom.
    const full = chanceGauge(1, 0, 0, 0, d);
    assertTrue(full.bottom < d && full.bottom - full.rail > 0);
    assertThat(full.level).isEqualTo(full.rail);
    // 1/32, the five-qubit uniform state, is a bar a reader can see, not a hairline under the grid.
    assertTrue(chanceGauge(Math.sqrt(1 / 32), 0, 0, 0, d).level >= 2);
    assertTrue(chanceGauge(1e-3, 0, 0, 0, d).level >= 2);
    // Nothing at all is drawn for an impossible outcome.
    assertThat(chanceGauge(0, 0, 0, 0, d)).isEqualTo(undefined);
    // Its height is the chance, in proportion to the rail.
    assertThat(chanceGauge(Math.SQRT1_2, 0, 0, 0, d).level).isApproximatelyEqualTo(full.rail / 2);
});

suite.test('a big enough cell prints its chance, in bitmap text that is pooled and reused', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    const half = Math.SQRT1_2;
    const {grid} = await cells(Matrix.fromRows([[half, 0], [0, half]]), new Rect(0, 0, 120, 120), {chanceLabels: true}, view);
    const shown = grid.labelPool.filter(text => text.visible);
    assertThat(shown.map(text => text.text)).isEqualTo(['50.0%', '50.0%']);
    const first = grid.labelPool[0];
    await cells(Matrix.fromRows([[1, 0], [0, 0]]), new Rect(0, 0, 120, 120), {chanceLabels: true}, view);
    assertThat(grid.labelPool[0] === first).isEqualTo(true);
    assertThat(grid.labelPool.filter(text => text.visible).map(text => text.text)).isEqualTo(['100%']);
});
