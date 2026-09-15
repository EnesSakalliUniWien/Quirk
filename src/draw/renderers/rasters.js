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

import {columnImage, structureFanOut} from '../../engine/simulation/columnStructure/evaluation.js';
import {phaseRgb} from '../../config/CanvasTheme.js';

/**
 * Data drawn as pixels rather than marks: one pixel per entry, or one per block of entries when
 * there are more entries than pixels. That level of detail is what lets a 65,536-row state or a
 * 65,536 x 65,536 operator be looked at at all - HiGlass draws genome contact matrices the same
 * way. The hue is the phase, on the wheel the disc renderers use (phaseColor in
 * src/config/CanvasTheme.js); the opacity is the magnitude. A block shows its largest entry, so
 * a single nonzero entry among thousands of zeros still shows.
 *
 * Plain functions over plain arrays: the operator tile worker uses them as well as the page.
 */

/** A tile's side in pixels. */
const TILE_SIZE = 256;
/** The faintest nonzero entry still shows at this opacity. */
const MIN_ALPHA = 0.3;
/** How many amplitudes one tile may work out before it samples operator columns instead. */
const TILE_BUDGET = 1 << 21;

/** The phase wheel as 0-255 RGB for each whole degree, as phaseColor writes it. */
const PHASE_RGB = (() => {
    const table = new Uint8Array(360 * 3);
    for (let degree = 0; degree < 360; degree++) {
        table.set(phaseRgb(degree), degree * 3);
    }
    return table;
})();

/**
 * The pixels [start, end) that entries [index, index + count) cover along an axis of `entries`
 * entries drawn over `pixels` pixels. Always at least one pixel, so no entry disappears.
 *
 * @returns {!Array.<!int>}
 */
function pixelSpan(index, count, entries, pixels) {
    const start = Math.min(pixels - 1, Math.floor(index * pixels / entries));
    const end = Math.max(start + 1, Math.floor((index + count) * pixels / entries));
    return [start, Math.min(end, pixels)];
}

/**
 * Paints an entry over a block of pixels, wherever it is the largest entry drawn there so far.
 *
 * @param {!Uint8ClampedArray} pixels RGBA.
 * @param {!Float32Array} best The magnitude each pixel shows.
 * @param {!int} stride Pixels per row.
 */
function paintBlock(pixels, best, stride, x0, x1, y0, y1, re, im) {
    const magnitude = Math.hypot(re, im);
    if (magnitude < 1e-9) {
        return;
    }
    const degree = ((Math.round(Math.atan2(im, re) * 180 / Math.PI) % 360) + 360) % 360;
    const alpha = Math.round(255 * Math.min(1, Math.max(MIN_ALPHA, magnitude)));
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = y * stride + x;
            if (magnitude > best[i]) {
                best[i] = magnitude;
                pixels[i * 4] = PHASE_RGB[degree * 3];
                pixels[i * 4 + 1] = PHASE_RGB[degree * 3 + 1];
                pixels[i * 4 + 2] = PHASE_RGB[degree * 3 + 2];
                pixels[i * 4 + 3] = alpha;
            }
        }
    }
}

/**
 * A matrix - an operator, a state grid, the evolution of a state - as RGBA pixels.
 *
 * @param {!Matrix} matrix
 * @param {!int} pixelWidth
 * @param {!int} pixelHeight
 * @returns {!Uint8ClampedArray}
 */
function rasterMatrix(matrix, pixelWidth, pixelHeight) {
    const width = matrix.width();
    const height = matrix.height();
    const buffer = matrix.rawBuffer();
    const pixels = new Uint8ClampedArray(pixelWidth * pixelHeight * 4);
    const best = new Float32Array(pixelWidth * pixelHeight);
    for (let row = 0; row < height; row++) {
        const [y0, y1] = pixelSpan(row, 1, height, pixelHeight);
        for (let col = 0; col < width; col++) {
            const k = (row * width + col) * 2;
            if (buffer[k] !== 0 || buffer[k + 1] !== 0) {
                const [x0, x1] = pixelSpan(col, 1, width, pixelWidth);
                paintBlock(pixels, best, pixelWidth, x0, x1, y0, y1, buffer[k], buffer[k + 1]);
            }
        }
    }
    return pixels;
}

/**
 * One tile of a column's operator. At `level` the operator is cut into 2^level x 2^level tiles,
 * and this is tile (x, y): TILE_SIZE pixels a side over 2^n / 2^level entries a side.
 *
 * The entries come from the column's structure one operator column at a time, so a tile costs its
 * columns times the column's fan-out. When that passes the budget - a column that spreads every
 * basis state over the whole register - it samples every few operator columns and widens each
 * sample over the ones it skipped: the overview stays true to the pattern, and zooming in, where
 * a tile has fewer columns, makes it exact.
 *
 * @param {!ColumnStructure} structure
 * @param {!int} level
 * @param {!int} x
 * @param {!int} y
 * @param {!number=} budget
 * @returns {!Uint8ClampedArray} TILE_SIZE x TILE_SIZE RGBA.
 */
function rasterOperatorTile(structure, level, x, y, budget = TILE_BUDGET) {
    const span = Math.max(1, (1 << structure.wireCount) >> level);
    const rowStart = y * span;
    const colStart = x * span;
    const pixels = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
    const best = new Float32Array(TILE_SIZE * TILE_SIZE);
    const stride = Math.max(1, Math.ceil(span * structureFanOut(structure) / budget));
    for (let col = colStart; col < colStart + span; col += stride) {
        const [x0, x1] = pixelSpan(col - colStart, Math.min(stride, colStart + span - col), span, TILE_SIZE);
        for (const [row, [re, im]] of columnImage(structure, col)) {
            if (row >= rowStart && row < rowStart + span) {
                const [y0, y1] = pixelSpan(row - rowStart, 1, span, TILE_SIZE);
                paintBlock(pixels, best, TILE_SIZE, x0, x1, y0, y1, re, im);
            }
        }
    }
    return pixels;
}

export {TILE_SIZE, rasterMatrix, rasterOperatorTile};
