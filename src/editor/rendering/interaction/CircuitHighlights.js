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

import {highlightRing, lineWidth, rectangle, strokePath} from '../../../draw/shapes/ShapeView.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {operationColumns} from '../../../circuit/operationColumns.js';

/**
 * Marks the column the playhead is about to execute, behind the wires and gates so they stay
 * readable through it.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {undefined|!int} playheadStep
 */
function drawPlayheadBand(context, painter, playheadStep) {
    // Once every column has run there is no next column to mark.
    if (playheadStep === undefined ||
            playheadStep < 0 ||
            playheadStep >= context.definition.columns.length) {
        return;
    }

    const nextColumn = operationColumns(context.definition).find(col => col >= playheadStep);
    if (nextColumn === undefined) return;
    const rect = context.geometry.gateRect(0, nextColumn, 1, context.geometry.groundedWireCount()).paddedBy(3);
    rectangle(painter, rect, {fill: CanvasTheme.interaction.playheadBand});
    strokePath(painter, [rect.topLeft(), rect.bottomLeft()], CanvasTheme.interaction.playhead, lineWidth(painter, 2));
}

function drawColumnDragHighlight(context, painter, col) {
    if (context.highlightedSlot !== undefined &&
        context.highlightedSlot.col === col &&
        context.highlightedSlot.row === undefined) {
        const rect = context.geometry.gateRect(0, col, 1, context.geometry.groundedWireCount()).paddedBy(3);
        rectangle(painter, rect, {fill: CanvasTheme.interaction.drop});
        highlightRing(painter, rect);
    }
}

/**
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 */
function drawRowDragHighlight(context, painter) {
    if (context.highlightedSlot !== undefined &&
            context.highlightedSlot.col === undefined &&
            context.highlightedSlot.row !== undefined) {

        const row = context.highlightedSlot.row;
        const w = context.geometry.gateRect(row, context.geometry.clampedCircuitColCount() + 1).x;
        const rect = context.geometry.wireRect(row).takeLeft(w);
        rectangle(painter, rect, {fill: CanvasTheme.interaction.drop});
        highlightRing(painter, rect);
    }
}

export {drawPlayheadBand, drawColumnDragHighlight, drawRowDragHighlight};
