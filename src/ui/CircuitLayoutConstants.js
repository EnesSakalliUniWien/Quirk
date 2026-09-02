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

/**
 * Geometry shared by the circuit itself and the code that maps positions back onto it.
 */

/** @type {!number} */
const CIRCUIT_OP_HORIZONTAL_SPACING = 10;

/** @type {!number} The gutter left of the first column, where the initial-state kets sit. */
const CIRCUIT_OP_LEFT_SPACING = 32;

/**
 * @type {!number} The strip beside and below the superposition grid where its binary labels draw;
 * the label painter scales its text down to fit this span, so the strip never needs to grow with
 * the wire count.
 */
const SUPERPOSITION_GRID_LABEL_SPAN = 50;

/** @type {!number} The width the caption paragraphs beside the output displays wrap into. */
const DISPLAY_CAPTION_WIDTH = 100;

/** @type {!number} The gap between the superposition grid and its captions. */
const DISPLAY_CAPTION_GAP = 3;

/**
 * @type {!number} The space kept right of the superposition grid: the row labels and the
 * "Final amplitudes" caption both draw there, so the margin is whichever needs more.
 */
const CIRCUIT_RIGHT_MARGIN = Math.max(
    SUPERPOSITION_GRID_LABEL_SPAN,
    DISPLAY_CAPTION_GAP + DISPLAY_CAPTION_WIDTH);

/**
 * @type {!number} The strip under the superposition grid's column labels where the measurement
 * and discard-rate warnings print.
 */
const DISPLAY_WARNING_STRIP_HEIGHT = 60;

/**
 * @type {!number} The space kept below the superposition grid: first the column labels, then the
 * warning strip.
 */
const CIRCUIT_BOTTOM_MARGIN = SUPERPOSITION_GRID_LABEL_SPAN + DISPLAY_WARNING_STRIP_HEIGHT;

export {
    CIRCUIT_OP_HORIZONTAL_SPACING,
    CIRCUIT_OP_LEFT_SPACING,
    SUPERPOSITION_GRID_LABEL_SPAN,
    DISPLAY_CAPTION_WIDTH,
    DISPLAY_CAPTION_GAP,
    DISPLAY_WARNING_STRIP_HEIGHT,
    CIRCUIT_RIGHT_MARGIN,
    CIRCUIT_BOTTOM_MARGIN,
}
