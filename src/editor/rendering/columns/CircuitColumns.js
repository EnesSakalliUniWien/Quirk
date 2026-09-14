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

import {renderGateView} from '../../../draw/gate/GateView.js';
import {GateRenderParams} from '../../../draw/gate/GateRenderParams.js';
import {DEFAULT_RENDERER} from '../../../draw/gate/GateRenderers.js';
import {drawColumnControlWires} from './CircuitControls.js';
import {drawGate_disabledReason, drawColumnSurvivalRate} from './CircuitWarnings.js';
import {drawColumnDragHighlight} from '../interaction/CircuitHighlights.js';

/**
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!GateColumn} gateColumn
 * @param {!int} col
 * @param {!PointerInteractionState} hand
 * @param {!CircuitStats} stats
 */
function drawColumn(context, painter, gateColumn, col, hand, stats) {
    drawColumnControlWires(context, painter, col);
    drawColumnDragHighlight(context, painter, col);

    for (let row = 0; row < context.definition.numWires; row++) {
        if (gateColumn.gates[row] === undefined) {
            continue;
        }
        const gate = gateColumn.gates[row];
        const gateRect = context.geometry.gateDrawRect(row, col, gate);

        const {isHighlighted, isResizeShowing, isResizeHighlighted} =
            context.highlightStatusAt(col, row, hand.hoverPoints());

        const renderer = gate.customRenderer || DEFAULT_RENDERER;
        renderGateView(painter, `gate-${col}-${row}`, GateRenderParams.inCircuit(painter, hand, gateRect, gate, stats, {row, col}, {
            isHighlighted: isHighlighted && !isResizeHighlighted,
            isResizeShowing,
            isResizeHighlighted,
            focusPoints: context.highlightedSlot === undefined ? hand.hoverPoints() : [],
            customStats: stats.customStatsForSlot(col, row)}), renderer);

        drawGate_disabledReason(context, painter, col, row, gateRect);
    }

    drawColumnSurvivalRate(context, painter, gateColumn, col, stats);
}

export {drawColumn};
