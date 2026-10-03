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

import {drawFirstGateSlot, drawWires} from './wires/CircuitWires.js';
import {drawPinnedWireNames, wireNamesPinPast} from './wires/CircuitGutter.js';
import {drawColumn} from './columns/CircuitColumns.js';
import {columnsInRange} from './columns/ColumnRange.js';
import {drawOutputDisplays} from './outputs/CircuitOutputs.js';
import {drawHintLabels} from './outputs/CircuitCaptions.js';
import {drawBreakpoints, drawPlayheadBand, drawRowDragHighlight, drawSelection, drawUnrunColumns} from './interaction/CircuitHighlights.js';

/**
 * Layers that take no pointer: the hit areas are CircuitTargets' and the displays' own, in the
 * columns and outputs, so Pixi need not walk these when it hit-tests a pointer move.
 */
const DECORATION = Object.freeze({pointer: false});

/**
 * Updates retained Pixi objects from prepared inputs; never reads or modifies CircuitViewState.
 * `follow`, while the playhead stands inside the circuit, is {stats, operation}: the state the
 * circuit has reached at the playhead, which the outputs show, and how many operations ran.
 *
 * `context.range`, when there is one, is the stretch of the circuit, in circuit units, to describe:
 * the columns that draw outside it are left out, and the wires, outputs, captions and selection,
 * which a few elements describe whole, are not.
 */
export function renderCircuitLayers(context, painter, hand, stats, forTooltip=false, showWires=true, playheadStep=undefined, breakpoints=[], selection=undefined, follow=undefined) {
    if (!forTooltip) {
        painter.group('playhead', view => drawPlayheadBand(context, view, playheadStep), DECORATION);
        painter.group('selection', view => drawSelection(context, view, selection, hand), DECORATION);
        painter.group('breakpoints', view => drawBreakpoints(context, view, breakpoints), DECORATION);
    }

    if (showWires) {
        painter.group('wires', view => drawWires(context, view, !forTooltip, hand), DECORATION);
    }

    // Keys are the columns' own indices, so one that scrolls into the range is mounted where it
    // stands, and the others are not remounted by its coming.
    const {columns, left, right} = columnsInRange(context.definition, context.geometry, context.range);
    for (const col of columns) {
        painter.group(`column-${col}`, view => drawColumn(context, view, context.definition.columns[col], col, hand, stats));
    }

    if (!forTooltip && context.definition.columns.every(column => column.gates.every(gate => gate === undefined))) {
        painter.group('first-slot', view => drawFirstGateSlot(context, view), DECORATION);
    }
    if (!forTooltip && follow !== undefined) {
        painter.group('unrun', view => drawUnrunColumns(context, view, playheadStep), DECORATION);
    }
    if (!forTooltip) {
        // What a scroll may move without the scene being described again (CircuitViewport.pan):
        // the whole scene, and the pinned names back to the viewport's edge, while they stay pinned
        // or stay unpinned, and while the viewport stays within `described`: the stretch in which
        // no column has been left out.
        const pinned = context.scrollX <= 0 ? undefined : painter.group('pinned-wire-names', view => {
            view.position.x = context.scrollX;
            drawPinnedWireNames(context, view, context.scrollX);
        }, DECORATION);
        let top = painter;
        while (top.parent !== undefined) top = top.parent;
        top.pan = {scrollX: context.scrollX, pinPast: wireNamesPinPast(context), pinned, described: {left, right}};
    }
    if (!forTooltip) {
        // While following the playhead, the outputs say the state the circuit has reached there.
        const outputStats = follow?.stats ?? stats;
        painter.group('outputs', view => drawOutputDisplays(context, view, outputStats, hand));
        painter.group('hints', view => drawHintLabels(context, view, outputStats), DECORATION);
    }

    painter.group('row-highlight', view => drawRowDragHighlight(context, view), DECORATION);
}
