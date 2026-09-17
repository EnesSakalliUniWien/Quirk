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

import {Layout} from "../../config/Layout.js"

/**
 * Geometry shared by the circuit itself and the code that maps positions back onto it.
 */

/** @type {!number} */
const CIRCUIT_OP_HORIZONTAL_SPACING = Layout.COLUMN_SPACING - 2 * Layout.GATE_RADIUS;

/** @type {!number} The gutter left of the first column, where the initial-state kets sit. */
const CIRCUIT_OP_LEFT_SPACING = 2 * Layout.REGISTER_MARGIN + Layout.REGISTER_INDEX_WIDTH +
    Layout.REGISTER_KET_WIDTH + Layout.REGISTER_WIRE_GAP;

/**
 * @type {!number} The strips left of and below the superposition grid where its binary labels draw;
 * the label painter scales its text down to fit this span, so the strips never need to grow with
 * the wire count. Row labels sit left of the grid, so they stay on screen with its first columns.
 */
const SUPERPOSITION_GRID_LABEL_SPAN = 50;

/** @type {!number} The least width the grid's key wraps into, under a grid narrower than that. */
const DISPLAY_CAPTION_WIDTH = 160;

/** @type {!number} The gap between the superposition grid's column labels and its key. */
const DISPLAY_CAPTION_GAP = 3;

/** @type {!number} The space kept right of the superposition grid, or of its key when that is wider. */
const CIRCUIT_RIGHT_MARGIN = Layout.GATE_RADIUS;

/**
 * @type {!number} The strip under the superposition grid's column labels where its key, then the
 * measurement and discard-rate warnings, print.
 */
const DISPLAY_WARNING_STRIP_HEIGHT = 72;

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
    CIRCUIT_RIGHT_MARGIN,
    CIRCUIT_BOTTOM_MARGIN,
}
