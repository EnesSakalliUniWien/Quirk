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

import {drawWires} from './wires/CircuitWires.js';
import {drawColumn} from './columns/CircuitColumns.js';
import {drawOutputDisplays} from './outputs/CircuitOutputs.js';
import {drawHintLabels} from './outputs/CircuitCaptions.js';
import {drawPlayheadBand, drawRowDragHighlight} from './interaction/CircuitHighlights.js';

/** Updates retained Pixi objects from prepared inputs; never reads or modifies CircuitViewState. */
export function renderCircuit(context, painter, hand, stats, forTooltip=false, showWires=true, playheadStep=undefined) {
    if (!forTooltip) {
        painter.group('playhead', view => drawPlayheadBand(context, view, playheadStep));
    }

    if (showWires) {
        painter.group('wires', view => drawWires(context, view, !forTooltip, hand));
    }

    for (let col = 0; col < context.definition.columns.length; col++) {
        painter.group(`column-${col}`, view => drawColumn(context, view, context.definition.columns[col], col, hand, stats));
    }

    if (!forTooltip) {
        painter.group('outputs', view => drawOutputDisplays(context, view, stats, hand));
        painter.group('hints', view => drawHintLabels(context, view, stats));
    }

    painter.group('row-highlight', view => drawRowDragHighlight(context, view));
}
