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

import {Suite, assertThat} from "../../TestUtil.js"
import {Complex} from "../../../src/engine/math/complex/Complex.js"
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js"
import {Rect} from "../../../src/geometry/Rect.js"
import {DisplayView} from "../scene/TestDisplayView.js"
import {LabelView} from "../../../src/draw/text/LabelView.js"
import {Registers} from "../../../src/circuit/model/Registers.js"
import {DATA_RENDERERS, stateGrid} from "../../../src/draw/renderers/dataRenderers.js"
import {CanvasTheme} from "../../../src/config/CanvasTheme.js"
import {Color} from "pixi.js"

const suite = new Suite("dataRenderers");

suite.test("a state's cells carry their basis states, in the registers' words, where they fit", async () => {
    const labels = async (rect, registers) => {
        const view = new DisplayView(document.createElement("canvas"));
        DATA_RENDERERS.state(view, stateGrid(Matrix.col(0.5, 0.5, 0.5, 0.5)), rect, {wireCount: 2, registers});
        await view.commit();
        const texts = [];
        const walk = node => {
            if (node instanceof LabelView) {
                texts.push(node.text);
            }
            for (const child of node.children ?? []) {
                walk(child);
            }
        };
        walk(view);
        return texts;
    };
    const roomy = new Rect(0, 0, 100, 100);
    assertThat(await labels(roomy, Registers.EMPTY)).isEqualTo(["00", "01", "10", "11"]);
    assertThat(await labels(roomy, new Registers([{name: "a", start: 0, length: 2}]))).isEqualTo(["a=0", "a=1", "a=2", "a=3"]);
    // A cell too small to read a label in carries none.
    assertThat(await labels(new Rect(0, 0, 40, 40), Registers.EMPTY)).isEqualTo([]);
});

suite.test("a state is laid out the way the amplitude display lays it out", async () => {
    // Four amplitudes become a 2x2 grid, row-major, so index r*width + c is the basis state.
    const grid = stateGrid(Matrix.col(1, new Complex(0, 2), 3, 4));
    assertThat(grid.width()).isEqualTo(2);
    assertThat(grid.height()).isEqualTo(2);
    assertThat(grid.cell(1, 0)).isEqualTo(new Complex(0, 2));
    assertThat(grid.cell(0, 1)).isEqualTo(new Complex(3, 0));

    // One qubit is a row of two, like the one-qubit amplitude display.
    const single = stateGrid(Matrix.col(1, 0));
    assertThat(single.width()).isEqualTo(2);
    assertThat(single.height()).isEqualTo(1);

    // Odd qubit counts are taller than wide.
    const three = stateGrid(Matrix.generate(1, 8, r => r));
    assertThat(three.width()).isEqualTo(2);
    assertThat(three.height()).isEqualTo(4);
});

suite.test("probability bars measure against the largest outcome, with no second scale drawn over them", async () => {
    const rect = new Rect(0, 0, 100, 200);
    const view = new DisplayView(document.createElement("canvas"));
    // 64%, 16%, nothing, 1e-6: bars of 1, 1/2, none and at least a pixel.
    DATA_RENDERERS.probabilities(view, Matrix.col(0.64, 0.16, 0, 0.000001), rect, {wireCount: 2});
    await view.commit();
    const bar = new Color(CanvasTheme.probability.bar).toNumber();
    const graphics = view.children.filter(child => child.context !== undefined);
    const bars = graphics.find(child => child.context.instructions.some(i => i.action === "fill" && i.data.style.color === bar));
    // Rows this tall get a bar each, short of the row's edges so equal neighbours stay apart.
    const rects = bars.context.instructions.find(i => i.action === "fill").data.path.instructions.
        filter(i => i.action === "rect").map(i => i.data.slice(0, 4));
    assertThat(rects.map(([, , w]) => w)).withInfo({rects}).isEqualTo([100, 50, 1]);
    assertThat(rects.map(([, y]) => Math.floor(y / 50))).isEqualTo([0, 1, 3]);
    assertThat(rects.every(([, , , h]) => h < 50)).isEqualTo(true);
    // Nothing else is stroked through every row: no logarithmic outline over the bars.
    const outlines = graphics.filter(child => child.context.instructions.some(i =>
        i.action === "stroke" && (i.data.path?.instructions ?? []).filter(step => step.action === "lineTo").length >= 4));
    assertThat(outlines.length).isEqualTo(0);
});

suite.test("rows too thin for kets group by their leading bits, with the prefix beside each group", async () => {
    const rect = new Rect(40, 0, 40, 200);
    const view = new DisplayView(document.createElement("canvas"));
    // 64 rows of 3.125 units: groups of 8 are the smallest 24 units tall, so the prefixes have 3 bits.
    DATA_RENDERERS.probabilities(view, Matrix.generate(1, 64, () => 1 / 64), rect, {wireCount: 6, groupLabels: true});
    await view.commit();
    const labels = [];
    const walk = node => {
        if (node instanceof LabelView) labels.push(node);
        for (const child of node.children ?? []) walk(child);
    };
    walk(view);
    assertThat(labels.map(label => label.text)).isEqualTo(["000⋯", "001⋯", "010⋯", "011⋯", "100⋯", "101⋯", "110⋯", "111⋯"]);
    assertThat(labels.every(label => label.getBounds().maxX <= rect.x)).isEqualTo(true);
    // Each group's bars are one outline, broken where the groups meet.
    const bar = new Color(CanvasTheme.probability.bar).toNumber();
    const fill = view.children.flatMap(child => child.context?.instructions ?? []).
        find(i => i.action === "fill" && i.data.style.color === bar);
    assertThat(fill.data.path.instructions.filter(i => i.action === "moveTo").length).isEqualTo(8);
    const guide = new Color(CanvasTheme.stroke.guide).toNumber();
    assertThat(view.children.some(child => (child.context?.instructions ?? []).some(i =>
        i.action === "stroke" && i.data.style.color === guide && i.data.style.width === 2))).isEqualTo(true);
});

suite.test("an impossible outcome reads 0% in muted ink beside its basis label", async () => {
    const view = new DisplayView(document.createElement("canvas"));
    DATA_RENDERERS.probabilities(view, Matrix.col(0.5, 0, 0, 0.5), new Rect(0, 0, 300, 120), {wireCount: 2});
    await view.commit();
    const labelled = [];
    const walk = node => {
        if (node instanceof LabelView) labelled.push(node);
        for (const child of node.children ?? []) walk(child);
    };
    walk(view);
    assertThat(labelled.map(label => label.text)).isEqualTo(["|00⟩", "50.0%", "|01⟩", "0%", "|10⟩", "0%", "|11⟩", "50.0%"]);
    const zero = labelled.find(label => label.text === "0%");
    const muted = new Color(CanvasTheme.text.muted).toNumber();
    assertThat(new Color(zero.style?.fill ?? zero.fill).toNumber()).withInfo({style: zero.style}).isEqualTo(muted);
});

suite.test("every kind of data has a renderer that draws into a view", async () => {
    const rect = new Rect(0, 0, 100, 100);
    const drawn = async kind => {
        const view = new DisplayView(document.createElement("canvas"));
        const data = {
            matrix: Matrix.square(1, 0, 0, new Complex(0, 1)),
            state: stateGrid(Matrix.col(Math.SQRT1_2, 0, 0, Math.SQRT1_2)),
            probabilities: Matrix.col(0.5, 0, 0, 0.5),
        }[kind];
        DATA_RENDERERS[kind](view, data, rect, {wireCount: 2});
        await view.commit();
        return view.children.length;
    };
    for (const kind of ["matrix", "state", "probabilities"]) {
        assertThat(await drawn(kind) > 0).withInfo({kind}).isEqualTo(true);
    }
    // A density matrix is a matrix drawn another way.
    const view = new DisplayView(document.createElement("canvas"));
    DATA_RENDERERS.matrix(view, Matrix.square(0.5, 0.5, 0.5, 0.5), rect, {style: "density"});
    await view.commit();
    assertThat(view.children.length > 0).isEqualTo(true);
});
