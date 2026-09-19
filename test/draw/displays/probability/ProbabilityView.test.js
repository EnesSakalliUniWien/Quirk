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
import {paintProbabilityBox, describeProbability, paintMultiProbabilityDisplay} from '../../../../src/draw/displays/probability/ProbabilityView.js';
import {Rect} from '../../../../src/geometry/Rect.js';
import {CanvasTheme} from '../../../../src/config/CanvasTheme.js';
import {Layout} from '../../../../src/config/Layout.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {Registers} from '../../../../src/circuit/model/Registers.js';
import {labelsIn} from '../../../editor/rendering/RenderingTestUtil.js';
const suite = new Suite('ProbabilityView');

/** The texts a four-wire Chance display draws, for a circuit that is still or one that animates. */
async function chanceTexts(probabilities, stableDuration) {
    const view = new DisplayView(document.createElement('canvas'));
    paintMultiProbabilityDisplay({
        painter: view, customStats: probabilities, gate: {height: 4}, positionInCircuit: {row: 0, col: 0},
        rect: new Rect(0, 0, 40, 2 * Layout.GATE_RADIUS + 3 * Layout.WIRE_SPACING), focusPoints: [],
        stats: {circuitDefinition: {registers: Registers.EMPTY, stableDuration: () => stableDuration}},
    });
    await view.commit();
    return labelsIn(view).map(label => label.text);
}

suite.test("a Chance display gives independent wires their own blocks, and keeps its key for the hover card", async () => {
    // A Bell pair on q0 q1, a fair coin on q2 and a 90/10 wire on q3.
    const joint = Matrix.col(...[...Array(16).keys()].map(i =>
        [0.5, 0, 0, 0.5][i & 3] * 0.5 * [0.9, 0.1][i >> 3]));
    const still = await chanceTexts(joint, Infinity);
    assertThat(still.filter(text => text === '⊗').length).withInfo({still}).isEqualTo(2);
    assertThat(['|00⟩', '|11⟩', '|0⟩', '|1⟩'].every(text => still.includes(text))).withInfo({still}).isEqualTo(true);
    // The bit order and the bars' scale are said by every row's hover card, not drawn under the gate.
    assertThat(still.some(text => text.startsWith('bits') || text.startsWith('full'))).withInfo({still}).isEqualTo(false);

    // An animated circuit keeps the joint rows, grouped by their leading bits since they are too thin for kets.
    const animated = await chanceTexts(joint, 0);
    assertThat(animated.includes('⊗')).withInfo({animated}).isEqualTo(false);
    assertThat(['000⋯', '111⋯'].every(text => animated.includes(text))).withInfo({animated}).isEqualTo(true);
});

suite.test("a probability box is a readout tile: the number above a thin bar on its track, never on the bar", async () => {
    for (const probability of [0, 0.25, 0.5, 0.75, 1]) {
        const painter = new DisplayView(document.createElement('canvas'));
        paintProbabilityBox(painter, probability, new Rect(0, 0, 40, 40));
        await painter.commit();
        const fills = painter.children.flatMap(child => child.context?.instructions ?? []).
            filter(i => i.action === 'fill').map(i => new Color(i.data.style.color).toHex());
        assertThat(fills[0]).withInfo({probability, fills}).isEqualTo(new Color(CanvasTheme.surface.readout).toHex());
        assertThat(fills.includes(new Color(CanvasTheme.probability.track).toHex())).withInfo({probability, fills}).isEqualTo(true);
        assertThat(fills.includes(new Color(CanvasTheme.probability.fill).toHex())).withInfo({probability, fills}).isEqualTo(probability > 0);
        // The bar is a strip at the tile's foot, under the number, and a possible outcome keeps a dot of it.
        const bars = painter.children.map(child => child.values).filter(values => values?.[0] === 'roundRect' && values[6] !== undefined && values[5] === 2);
        assertThat(bars.length).withInfo({probability}).isEqualTo(probability > 0 ? 2 : 1);
        assertThat(bars.every(([, , y, , h]) => y >= 30 && y + h <= 40)).withInfo({probability, bars}).isEqualTo(true);
        if (probability > 0) assertThat(bars[1][3]).withInfo({probability}).isEqualTo(Math.max(4, 28 * probability));
    }
});

suite.test("describeProbability_middle", async () => {
    assertThat(describeProbability(1/3, 0)).isEqualTo("33%");
    assertThat(describeProbability(1/3, 1)).isEqualTo("33.3%");
    assertThat(describeProbability(1/3, 2)).isEqualTo("33.33%");

    assertThat(describeProbability(1/2, 0)).isEqualTo("50%");
    assertThat(describeProbability(1/2, 1)).isEqualTo("50.0%");
    assertThat(describeProbability(1/2, 2)).isEqualTo("50.00%");

    assertThat(describeProbability(2/3, 0)).isEqualTo("67%");
    assertThat(describeProbability(2/3, 1)).isEqualTo("66.7%");
    assertThat(describeProbability(2/3, 2)).isEqualTo("66.67%");
});

suite.test("describeProbability_borders", async () => {
    // Off and On are only for a qubit that is certainly off or on.
    assertThat(describeProbability(0, 0)).isEqualTo("Off");
    assertThat(describeProbability(0, 1)).isEqualTo("Off");
    assertThat(describeProbability(0, 2)).isEqualTo("Off");
    // Single-precision round-off where the chance is exactly zero or one.
    assertThat(describeProbability(1e-14, 1)).isEqualTo("Off");
    assertThat(describeProbability(1 - 1e-14, 1)).isEqualTo("On");

    // A chance that rounds to 0% or 100% still says it can go either way.
    assertThat(describeProbability(0.00001, 0)).isEqualTo("<1%");
    assertThat(describeProbability(0.00001, 1)).isEqualTo("<0.1%");
    assertThat(describeProbability(0.00001, 2)).isEqualTo("<0.01%");

    assertThat(describeProbability(0.004, 0)).isEqualTo("<1%");
    assertThat(describeProbability(0.0004, 0)).isEqualTo("<1%");
    assertThat(describeProbability(0.0004, 1)).isEqualTo("<0.1%");
    assertThat(describeProbability(0.0004, 2)).isEqualTo("0.04%");

    assertThat(describeProbability(0.006, 0)).isEqualTo("1%");
    assertThat(describeProbability(0.0006, 0)).isEqualTo("<1%");
    assertThat(describeProbability(0.0006, 1)).isEqualTo("0.1%");
    assertThat(describeProbability(0.0006, 2)).isEqualTo("0.06%");

    assertThat(describeProbability(0.996, 0)).isEqualTo(">99%");
    assertThat(describeProbability(0.9996, 0)).isEqualTo(">99%");
    assertThat(describeProbability(0.9996, 1)).isEqualTo(">99.9%");
    assertThat(describeProbability(0.9996, 2)).isEqualTo("99.96%");

    assertThat(describeProbability(0.994, 0)).isEqualTo("99%");
    assertThat(describeProbability(0.9994, 0)).isEqualTo(">99%");
    assertThat(describeProbability(0.9994, 1)).isEqualTo("99.9%");
    assertThat(describeProbability(0.9994, 2)).isEqualTo("99.94%");

    assertThat(describeProbability(0.99999, 0)).isEqualTo(">99%");
    assertThat(describeProbability(0.99999, 1)).isEqualTo(">99.9%");
    assertThat(describeProbability(0.99999, 2)).isEqualTo(">99.99%");

    assertThat(describeProbability(1, 0)).isEqualTo("On");
    assertThat(describeProbability(1, 1)).isEqualTo("On");
    assertThat(describeProbability(1, 2)).isEqualTo("On");
});
