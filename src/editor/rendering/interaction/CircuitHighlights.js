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

import {circle, highlightRing, lineWidth, rectangle, strokePath} from '../../../draw/shapes/ShapeView.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Point} from '../../../geometry/Point.js';
import {Rect} from '../../../geometry/Rect.js';
import {operationColumns} from '../../../circuit/operationColumns.js';
import {rangeBetween, selectionRect} from '../../interaction/RangeSelection.js';

/**
 * Marks the column the playhead is about to execute, behind the wires and gates so they stay
 * readable through it.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {undefined|!int} playheadStep
 */
function drawPlayheadBand(context, painter, playheadStep) {
    const rect = playheadRect(context, playheadStep);
    if (rect === undefined) return;
    // A bracket opening onto the column, over a neutral band: the next column to run reads as a
    // place in the run, never as a hovered gate.
    rectangle(painter, rect, {fill: CanvasTheme.interaction.playheadBand});
    drawPlayheadBracket(painter, rect);
}

/**
 * The band around the next operation column the playhead runs, or undefined once every column has
 * run and there is none.
 * @param {!Object} context
 * @param {undefined|!int} playheadStep
 * @returns {undefined|!Rect}
 */
function playheadRect(context, playheadStep) {
    if (playheadStep === undefined ||
            playheadStep < 0 ||
            playheadStep >= context.definition.columns.length) {
        return undefined;
    }
    const nextColumn = operationColumns(context.definition).find(col => col >= playheadStep);
    if (nextColumn === undefined) return undefined;
    return context.geometry.gateRect(0, nextColumn, 1, context.geometry.groundedWireCount()).paddedBy(3);
}

/** @param {!DisplayView} painter @param {!Rect} rect */
function drawPlayheadBracket(painter, rect) {
    const tick = Math.min(8, rect.w / 3);
    strokePath(painter, [rect.topLeft().offsetBy(tick, 0), rect.topLeft(), rect.bottomLeft(),
        rect.bottomLeft().offsetBy(tick, 0)], CanvasTheme.interaction.playhead, lineWidth(painter, 2));
}

/**
 * While the playhead stands inside the circuit, the columns after the one it runs next stand back
 * under a veil of the canvas, to the circuit's end: the circuit reads as run up to the bracket, the
 * next column waits in its band, and the outputs show the state reached there.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!int} playheadStep
 */
function drawUnrunColumns(context, painter, playheadStep) {
    const rect = playheadRect(context, playheadStep);
    if (rect === undefined) return;
    const start = rect.right() + 1;
    const end = context.geometry.opRect(context.definition.columns.length).x;
    if (end <= start) return;
    painter.group('unrun-veil-' + painter.order, veil => {
        veil.alpha *= 0.62;
        rectangle(veil, new Rect(start, rect.y, end - start, rect.h), {fill: CanvasTheme.surface.background});
    });
}


/**
 * Marks each column a run halts before with a debugger's dot, above the column's top wire.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!Array.<!int>} breakpoints
 */
function drawBreakpoints(context, painter, breakpoints) {
    for (const col of breakpoints) {
        if (col >= context.definition.columns.length) continue;
        const rect = context.geometry.gateRect(0, col, 1, 1);
        circle(painter, new Point(rect.center().x, rect.y - 9), 5, {fill: CanvasTheme.interaction.breakpoint});
    }
}

/**
 * Marks the selected part of the circuit, behind the wires and gates like the playhead's band. While
 * a box is being dragged, the range it would select is outlined dashed instead.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {undefined|!CircuitRange} selection
 * @param {!PointerInteractionState} hand
 */
function drawSelection(context, painter, selection, hand) {
    const from = hand.selectingRangeFrom;
    const dragging = from !== undefined && hand.pos !== undefined;
    const range = dragging ? rangeBetween(context.definition, context.geometry, from, hand.pos) : selection;
    if (range === undefined) {
        return;
    }
    const rect = selectionRect(context.geometry, range);
    rectangle(painter, rect, {fill: CanvasTheme.interaction.selection});
    strokePath(painter, [rect.topLeft(), rect.topRight(), rect.bottomRight(), rect.bottomLeft(), rect.topLeft()],
        CanvasTheme.interaction.selectionEdge, lineWidth(painter, 1.5), dragging ? [5, 4] : []);
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

export {drawBreakpoints, drawPlayheadBand, drawSelection, drawColumnDragHighlight, drawRowDragHighlight, drawUnrunColumns};
