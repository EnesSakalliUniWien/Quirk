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

import {lineWidth, strokePath} from '../../../draw/shapes/ShapeView.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Point} from '../../../geometry/Point.js';

/**
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!int} columnIndex
 */
function drawColumnControlWires(context, painter, columnIndex) {
    const x = Math.round(context.geometry.opRect(columnIndex).center().x - 0.5) + 0.5;

    // Dashed line indicates effects from non-unitary gates may affect, or appear to affect, other wires.
    if (context.definition.columns[columnIndex].hasGatesWithGlobalEffects()) {
        painter.group('global-control-' + painter.order, painter => {
            strokePath(painter, [new Point(x, context.geometry.gateRect(0, 0).y), new Point(x, context.geometry.opRect(0).bottom() - 40)], CanvasTheme.text.primary, 1, [1, 4]);
        });
    }

    for (const {first, last, measured} of context.definition.controlLinesRanges(columnIndex)) {
        const y1 =  context.geometry.wireRect(first).center().y;
        const y2 = context.geometry.wireRect(last).center().y;
        const w = lineWidth(painter, 1);
        if (measured) {
            strokePath(painter, [new Point(x+w, y1), new Point(x+w, y2)], CanvasTheme.iqp.classicalWire, w);
            strokePath(painter, [new Point(x-w, y1), new Point(x-w, y2)], CanvasTheme.iqp.classicalWire, w);
        } else {
            strokePath(painter, [new Point(x, y1), new Point(x, y2)], CanvasTheme.text.primary, w);
        }
    }
}

export {drawColumnControlWires};
