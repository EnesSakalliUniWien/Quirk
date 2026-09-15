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
import {columnStructure} from "../../../src/engine/simulation/columnStructure/columnStructure.js";
import { fromJsonText_CircuitDefinition } from "../../../src/serialization/circuits/text.js";
import {TILE_SIZE, rasterMatrix, rasterOperatorTile} from "../../../src/draw/renderers/rasters.js"
import {phaseRgb} from "../../../src/config/CanvasTheme.js"

const suite = new Suite("rasters");

/** @returns {!Array.<!int>} The RGBA of one pixel. */
const pixel = (pixels, width, x, y) => [...pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 4)];

const structureOf = (cols, wireCount) =>
    columnStructure(fromJsonText_CircuitDefinition(JSON.stringify({cols})), 0, wireCount, 0);

suite.test("an entry is a pixel whose hue is its phase and whose opacity is its magnitude", () => {
    const pixels = rasterMatrix(Matrix.square(1, 0, 0, new Complex(0, 0.5)), 2, 2);
    // Phase zero is the wheel's colour at zero degrees, the one the state panel's swatch shows.
    assertThat(pixel(pixels, 2, 0, 0)).isEqualTo([...phaseRgb(0), 255]);
    // A zero is left clear, and a half-size entry is half opaque.
    assertThat(pixel(pixels, 2, 1, 0)).isEqualTo([0, 0, 0, 0]);
    assertThat(pixel(pixels, 2, 1, 1)[3]).isEqualTo(128);
});

suite.test("more entries than pixels keeps the nonzero ones", () => {
    // One nonzero entry in sixteen, drawn in four pixels, still shows in its block.
    const buffer = new Float64Array(4 * 4 * 2);
    buffer[(3 * 4 + 0) * 2] = 1;
    const pixels = rasterMatrix(new Matrix(4, 4, buffer), 2, 2);
    assertThat(pixel(pixels, 2, 0, 1)[3]).isEqualTo(255);
    assertThat([0, 1].map(x => pixel(pixels, 2, x, 0)[3])).isEqualTo([0, 0]);
    assertThat(pixel(pixels, 2, 1, 1)[3]).isEqualTo(0);
});

suite.test("an operator tile shows where each basis state goes, at any size", () => {
    // Increment over 16 qubits: |c> goes to |c+1>, just under the diagonal, and |65535> wraps to |0>.
    const structure = structureOf([["inc16"]], 16);
    const overview = rasterOperatorTile(structure, 0, 0, 0);
    assertThat(pixel(overview, TILE_SIZE, 10, 10)[3]).isEqualTo(255);
    assertThat(pixel(overview, TILE_SIZE, 10, 200)[3]).isEqualTo(0);
    assertThat(pixel(overview, TILE_SIZE, 255, 0)[3]).isEqualTo(255);

    // At level 8 a tile is 256 entries a side: one pixel each.
    const fine = rasterOperatorTile(structure, 8, 0, 0);
    assertThat(pixel(fine, TILE_SIZE, 0, 1)[3]).isEqualTo(255);
    assertThat(pixel(fine, TILE_SIZE, 0, 0)[3]).isEqualTo(0);
});

suite.test("a column that spreads everywhere is sampled, not left with gaps", () => {
    // A Hadamard on each of 12 wires: every entry is nonzero, far past a small budget.
    const tile = rasterOperatorTile(structureOf([Array(12).fill("H")], 12), 0, 0, 0, 1 << 14);
    for (const [x, y] of [[0, 0], [100, 37], [255, 255]]) {
        assertThat(pixel(tile, TILE_SIZE, x, y)[3] > 0).withInfo({x, y}).isEqualTo(true);
    }
});
