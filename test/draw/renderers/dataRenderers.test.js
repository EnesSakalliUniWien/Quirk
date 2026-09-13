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
import {DisplayView} from "../../../src/draw/pixi/DisplayView.js"
import {LabelView} from "../../../src/draw/pixi/LabelView.js"
import {Registers} from "../../../src/circuit/model/Registers.js"
import {DATA_RENDERERS, stateGrid} from "../../../src/draw/renderers/dataRenderers.js"

const suite = new Suite("dataRenderers");

suite.test("a state's cells carry their basis states, in the registers' words, where they fit", () => {
    const labels = (rect, registers) => {
        const view = new DisplayView();
        DATA_RENDERERS.state(view, stateGrid(Matrix.col(0.5, 0.5, 0.5, 0.5)), rect, {wireCount: 2, registers});
        view.finish();
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
    assertThat(labels(roomy, Registers.EMPTY)).isEqualTo(["00", "01", "10", "11"]);
    assertThat(labels(roomy, new Registers([{name: "a", start: 0, length: 2}]))).isEqualTo(["a=0", "a=1", "a=2", "a=3"]);
    // A cell too small to read a label in carries none.
    assertThat(labels(new Rect(0, 0, 40, 40), Registers.EMPTY)).isEqualTo([]);
});

suite.test("a state is laid out the way the amplitude display lays it out", () => {
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

suite.test("every kind of data has a renderer that draws into a view", () => {
    const rect = new Rect(0, 0, 100, 100);
    const drawn = kind => {
        const view = new DisplayView();
        const data = {
            matrix: Matrix.square(1, 0, 0, new Complex(0, 1)),
            state: stateGrid(Matrix.col(Math.SQRT1_2, 0, 0, Math.SQRT1_2)),
            probabilities: Matrix.col(0.5, 0, 0, 0.5),
        }[kind];
        DATA_RENDERERS[kind](view, data, rect, {wireCount: 2});
        view.finish();
        return view.children.length;
    };
    for (const kind of ["matrix", "state", "probabilities"]) {
        assertThat(drawn(kind) > 0).withInfo({kind}).isEqualTo(true);
    }
    // A density matrix is a matrix drawn another way.
    const view = new DisplayView();
    DATA_RENDERERS.matrix(view, Matrix.square(0.5, 0.5, 0.5, 0.5), rect, {style: "density"});
    view.finish();
    assertThat(view.children.length > 0).isEqualTo(true);
});
