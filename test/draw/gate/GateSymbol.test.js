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

import {assertThat, Suite} from '../../TestUtil.js';
import {fitGateSymbol, splitGateSymbol, paintGateSymbol} from '../../../src/draw/gate/GateSymbol.js';
import {Typography} from '../../../src/config/Typography.js';
import {RenderSurface} from '../../../src/draw/surface/RenderSurface.js';
import {Rect} from '../../../src/geometry/Rect.js';

const suite = new Suite("GateSymbol");

suite.test("splitGateSymbol_breaksAtArgumentOrNearestMiddle", () => {
    assertThat(splitGateSymbol("Rx(f(t))")).isEqualTo(["Rx", "(f(t))"]);
    assertThat(splitGateSymbol("a/b c")).isEqualTo(["a/", "b c"]);
    assertThat(splitGateSymbol("XYZ")).isEqualTo(["XYZ"]);
});

suite.test("layout updates labels within the gate without a ticker and disposes removed rows", async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const surface = new RenderSurface(canvas);
    const labelsIn = node => node.text === undefined ? node.children.flatMap(labelsIn) : [node];
    let previousLabels = [];
    try {
        for (const ratio of [1, 2]) {
            for (const [symbol, expected, allowExponent = true] of [
                ['×A^-1\nmod R', ['×A', '-1', 'mod R']],
                ['H', ['H']],
                ['Rz(123456789*f(t))', ['Rz', '(123456789*f(t))']],
                ['X^½', ['X', '½']],
                ['X^½', ['X^½'], false],
                ['', ['']]
            ]) {
                const rect = new Rect(10, 10, 40, 40);
                const view = surface.beginFrame(undefined, ratio);
                paintGateSymbol({painter: view, rect, gate: {symbol}}, undefined, allowExponent);
                await surface.render();
                const labels = labelsIn(surface.app.stage);
                assertThat(labels.map(label => label.text)).isEqualTo(expected);
                assertThat(surface.app.ticker.started).isEqualTo(false);
                for (const label of labels.filter(label => label.text)) {
                    const bounds = label.getBounds();
                    assertThat(bounds.minX >= rect.x * ratio && bounds.maxX <= rect.right() * ratio &&
                        bounds.minY >= rect.y * ratio && bounds.maxY <= rect.bottom() * ratio).
                        withInfo({symbol, ratio, bounds}).isEqualTo(true);
                }
                for (const label of previousLabels.filter(label => !labels.includes(label))) {
                    assertThat(label.destroyed).isEqualTo(true);
                    assertThat(label.layout.destroyed).isEqualTo(true);
                }
                previousLabels = labels;
            }
        }
        surface.beginFrame();
        await surface.render();
        assertThat(labelsIn(surface.app.stage)).isEqualTo([]);
        assertThat(previousLabels.every(label => label.destroyed && label.layout.destroyed)).isEqualTo(true);
    } finally {
        await surface.destroy();
    }
});

suite.test("fitGateSymbol_stepsDownTheRampBeforeWrapping", () => {
    const wide = fitGateSymbol("Z", 40);
    assertThat(wide.lines).isEqualTo(["Z"]);
    assertThat(wide.font.fontSize).isEqualTo(Typography.GATE_SYMBOL_FONT_SIZE);

    const narrow = fitGateSymbol("Rz(f(t))", 20);
    assertThat(narrow.lines).isEqualTo(["Rz", "(f(t))"]);
    assertThat(narrow.font.fontSize).isEqualTo(Typography.GATE_SYMBOL_MIN_FONT_SIZE);
});
