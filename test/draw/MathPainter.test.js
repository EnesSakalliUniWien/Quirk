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

import {Container, Color} from 'pixi.js';

import {Suite, assertThat} from '../TestUtil.js';
import {MathPainter} from '../../src/draw/MathPainter.js';
import {DisplayView} from './TestDisplayView.js';
import {Rect} from '../../src/math/Rect.js';
import {Matrix} from '../../src/math/Matrix.js';
import {CanvasTheme, phaseColor} from '../../src/config/CanvasTheme.js';

let suite = new Suite("MathPainter");

suite.test("probabilityLabels_haveAnOpaquePlateForEveryFillLevel", () => {
    for (const probability of [0, 0.25, 0.5, 0.75, 1]) {
        const painter = new DisplayView(document.createElement('canvas'));
        MathPainter.paintProbabilityBox(painter, probability, new Rect(0, 0, 40, 40));
        const marks = painter.children.filter(child => child.context?.instructions.some(i => i.action === 'fill'));
        const mark = marks.at(-1);
        const fill = mark.context.instructions.find(i => i.action === 'fill');
        const plate = {color: new Color(fill.data.style.color).toHex(), rect: new Rect(...mark.values.slice(1, 5))};
        assertThat(plate.color).isEqualTo(new Color(CanvasTheme.surface.gate).toHex());
        assertThat(plate.rect.center().x).isEqualTo(20);
        assertThat(plate.rect.center().y).isEqualTo(20);
        assertThat(plate.rect.w > 0 && plate.rect.h > 0).isEqualTo(true);
    }
});

suite.test("phaseMapping_ignoresZeroEntriesAndCanSuppressUndefinedLocalPhase", () => {
    const painter = new DisplayView(document.createElement('canvas'));
    const phases = [];
    MathPainter.paintMatrix(painter, Matrix.fromRows([[0, 1], [-1, 0]]), new Rect(0, 0, 80, 80),
        CanvasTheme.amplitude.circle, CanvasTheme.text.primary, CanvasTheme.amplitude.fill,
        CanvasTheme.amplitude.background, angle => { phases.push(angle); return phaseColor(angle); });
    assertThat(phases).isEqualTo([0, 180]);

    painter.begin();
    MathPainter.paintMatrix(painter, Matrix.solo(1), new Rect(0, 0, 40, 40),
        undefined, CanvasTheme.text.primary, undefined, CanvasTheme.amplitude.background, () => undefined);
    // Only the grid halo and grid stroke remain; no false phase is drawn for incoherent data.
    painter.finish();
    const strokes = painter.children.flatMap(child => child.context?.instructions || [])
        .filter(i => i.action === 'stroke').map(i => i.data.style.color);
    assertThat(strokes).isEqualTo([CanvasTheme.amplitude.phaseHalo, CanvasTheme.stroke.grid].map(c => new Color(c).toNumber()));
});

suite.test("valueTooltip_staysInsideZoomedScrolledViewport", () => {
    for (let dpr of [1, 2]) {
        for (let zoom of [0.5, 1, 1.5, 2]) {
            for (let scroll of [0, 180]) {
                for (let corner of [[0, 0], [320, 0], [0, 240], [320, 240]]) {
                    let canvas = document.createElement('canvas');
                    canvas.width = 320 * dpr;
                    canvas.height = 240 * dpr;
                    let painter = new DisplayView(canvas, undefined, dpr * zoom);
                    painter.position.set(-scroll / zoom, -scroll / zoom);
                    const stage = new Container();
                    stage.scale.set(dpr * zoom);
                    stage.addChild(painter, painter.tooltips);
                    MathPainter.paintDeferredValueTooltip(painter,
                        (corner[0] + scroll) / zoom, (corner[1] + scroll) / zoom,
                        'Amplitude', '0.5', 'phase: 0');
                    painter.tooltips?.flush();
                    assertThat(painter.tooltips.children.length).isEqualTo(1);
                    const tooltip = painter.tooltips.children[0];
                    const a = tooltip.toGlobal(tooltip.bounds.topLeft());
                    const b = tooltip.toGlobal(tooltip.bounds.bottomRight());
                    let halfStroke = dpr * zoom / 2;
                    assertThat(a.x - halfStroke >= 0 && a.y - halfStroke >= 0 &&
                        b.x + halfStroke <= canvas.width && b.y + halfStroke <= canvas.height).isEqualTo(true);
                }
            }
        }
    }
});

suite.test("describeProbability_middle", () => {
    assertThat(MathPainter.describeProbability(1/3, 0)).isEqualTo("33%");
    assertThat(MathPainter.describeProbability(1/3, 1)).isEqualTo("33.3%");
    assertThat(MathPainter.describeProbability(1/3, 2)).isEqualTo("33.33%");

    assertThat(MathPainter.describeProbability(1/2, 0)).isEqualTo("50%");
    assertThat(MathPainter.describeProbability(1/2, 1)).isEqualTo("50.0%");
    assertThat(MathPainter.describeProbability(1/2, 2)).isEqualTo("50.00%");

    assertThat(MathPainter.describeProbability(2/3, 0)).isEqualTo("67%");
    assertThat(MathPainter.describeProbability(2/3, 1)).isEqualTo("66.7%");
    assertThat(MathPainter.describeProbability(2/3, 2)).isEqualTo("66.67%");
});

suite.test("describeProbability_borders", () => {
    assertThat(MathPainter.describeProbability(0, 0)).isEqualTo("Off");
    assertThat(MathPainter.describeProbability(0, 1)).isEqualTo("Off");
    assertThat(MathPainter.describeProbability(0, 2)).isEqualTo("Off");

    assertThat(MathPainter.describeProbability(0.00001, 0)).isEqualTo("Off");
    assertThat(MathPainter.describeProbability(0.00001, 1)).isEqualTo("Off");
    assertThat(MathPainter.describeProbability(0.00001, 2)).isEqualTo("Off");

    assertThat(MathPainter.describeProbability(0.004, 0)).isEqualTo("Off");
    assertThat(MathPainter.describeProbability(0.0004, 0)).isEqualTo("Off");
    assertThat(MathPainter.describeProbability(0.0004, 1)).isEqualTo("Off");
    assertThat(MathPainter.describeProbability(0.0004, 2)).isEqualTo("0.04%");

    assertThat(MathPainter.describeProbability(0.006, 0)).isEqualTo("1%");
    assertThat(MathPainter.describeProbability(0.0006, 0)).isEqualTo("Off");
    assertThat(MathPainter.describeProbability(0.0006, 1)).isEqualTo("0.1%");
    assertThat(MathPainter.describeProbability(0.0006, 2)).isEqualTo("0.06%");

    assertThat(MathPainter.describeProbability(0.996, 0)).isEqualTo("On");
    assertThat(MathPainter.describeProbability(0.9996, 0)).isEqualTo("On");
    assertThat(MathPainter.describeProbability(0.9996, 1)).isEqualTo("On");
    assertThat(MathPainter.describeProbability(0.9996, 2)).isEqualTo("99.96%");

    assertThat(MathPainter.describeProbability(0.994, 0)).isEqualTo("99%");
    assertThat(MathPainter.describeProbability(0.9994, 0)).isEqualTo("On");
    assertThat(MathPainter.describeProbability(0.9994, 1)).isEqualTo("99.9%");
    assertThat(MathPainter.describeProbability(0.9994, 2)).isEqualTo("99.94%");

    assertThat(MathPainter.describeProbability(0.99999, 0)).isEqualTo("On");
    assertThat(MathPainter.describeProbability(0.99999, 1)).isEqualTo("On");
    assertThat(MathPainter.describeProbability(0.99999, 2)).isEqualTo("On");

    assertThat(MathPainter.describeProbability(1, 0)).isEqualTo("On");
    assertThat(MathPainter.describeProbability(1, 1)).isEqualTo("On");
    assertThat(MathPainter.describeProbability(1, 2)).isEqualTo("On");
});
