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

import {rectangle} from '../../../draw/shapes/ShapeView.js';
import {measureText, drawText} from '../../../draw/text/TextLayout.js';
import {drawingArea} from '../../../draw/scene/DisplayView.js';
import {BasisLabels} from '../../../draw/text/BasisLabels.js';
import {Layout} from '../../../config/Layout.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {Rect} from '../../../geometry/Rect.js';
import { bin } from "../../../base/Format.js";
import {SUPERPOSITION_GRID_LABEL_SPAN} from '../../geometry/CircuitLayoutConstants.js';

// One ellipsis stands in for the bits the other axis supplies, keeping labels short enough to read.
const SUPERPOSITION_GRID_LABEL_ELLIPSIS = '⋯';

/**
 * @param {!DisplayView} painter
 * @param {!number} dy
 * @param {!int} n
 * @param {!function(!int) : !String} labeller
 * @param {!number} boundingWidth
 * @param {!boolean=} alignEnd Whether labels end at the strip's far edge, to hug a grid on their right.
 * @private
 */
function _drawLabelsReasonablyFast(painter, dy, n, labeller, boundingWidth, alignEnd = false) {
    painter.group('basis-text-' + painter.order, painter => {
        const font = {
            fontSize: 12,
            fontFamily: Typography.MONO_FONT_FAMILY
        };
        const w = Math.max(measureText(labeller(0), font).width, measureText(labeller(n - 1), font).width);
        const h = Math.max(measureText(labeller(0), font).height, measureText(labeller(n - 1), font).height);
        const scale = Math.min(Math.min((boundingWidth - 2) / w, dy / h), 1);

        // Row labels.
        const step = dy / scale;
        const pad = 1 / scale;
        const offset = alignEnd ? boundingWidth / scale - (w + 2 * pad) : 0;
        painter.scale.set(scale, scale);
        painter.position.set(0, dy * 0.5 - scale * h * 0.5);
        if (h < step * 0.95) {
            for (let i = 0; i < n; i++) {
                rectangle(painter, new Rect(offset, step * i, w + 2 * pad, h), {
                    fill: CanvasTheme.surface.gate
                });
            }
        } else {
            rectangle(painter, new Rect(offset, 0, w + 2 * pad, step * n), {
                fill: CanvasTheme.surface.gate
            });
        }
        for (let i = 0; i < n; i++) {
            drawText(painter, labeller(i), {
                x: offset + pad,
                y: h * 0.5 + step * i,
                fill: CanvasTheme.text.primary,
                font,
                align: 'left',
                baseline: 'middle'
            });
        }
    });
}

/**
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 */
function drawOutputSuperpositionDisplay_labels(context, painter) {
    const gridRect = context.geometry.rectForSuperpositionDisplay();
    const numWire = context.geometry.importantWireCount();
    // Row labels sit left of the grid, where they stay on screen with its first columns.
    _cachedRowLabelRenderer.paint(gridRect.x - SUPERPOSITION_GRID_LABEL_SPAN, gridRect.y, painter, numWire);
    _cachedColLabelRenderer.paint(gridRect.x, gridRect.bottom(), painter, numWire);
}

function invalidateCircuitLabelCache() {
    _cachedRowLabelRenderer.clear();
    _cachedColLabelRenderer.clear();
}

const _cachedRowLabelRenderer = new BasisLabels(
    numWire => ({
        width: SUPERPOSITION_GRID_LABEL_SPAN,
        height: (numWire - 1) * Layout.WIRE_SPACING + Layout.GATE_RADIUS * 2
    }),
    (painter, numWire) => {
        const rowWires = Math.ceil(numWire/2);
        const rowCount = 1 << rowWires;
        _drawLabelsReasonablyFast(
            painter,
            drawingArea(painter).h / rowCount,
            rowCount,
            // One ellipsis stands in for the bits the column supplies, keeping the label short enough to stay legible.
            i => bin(i, rowWires) + SUPERPOSITION_GRID_LABEL_ELLIPSIS,
            SUPERPOSITION_GRID_LABEL_SPAN,
            true);
    });

const _cachedColLabelRenderer = new BasisLabels(
    numWire => {
        const [colWires, rowWires] = [Math.floor(numWire/2), Math.ceil(numWire/2)];
        const [colCount, rowCount] = [1 << colWires, 1 << rowWires];
        const total_height = (numWire - 1) * Layout.WIRE_SPACING + Layout.GATE_RADIUS * 2;
        const cellDiameter = total_height / rowCount;
        return {
            width: colCount * cellDiameter,
            height: SUPERPOSITION_GRID_LABEL_SPAN
        }
    },
    (painter, numWire) => {
        const colWires = Math.floor(numWire/2);
        const colCount = 1 << colWires;
        const dw = drawingArea(painter).w / colCount;

        painter.position.set(colCount*dw, 0);
        painter.rotation = Math.PI/2;
        _drawLabelsReasonablyFast(
            painter,
            dw,
            colCount,
            // One ellipsis stands in for the bits the row supplies, keeping the label short enough to stay legible.
            i => SUPERPOSITION_GRID_LABEL_ELLIPSIS + bin(colCount-1-i, colWires),
            SUPERPOSITION_GRID_LABEL_SPAN);
    });

export {drawOutputSuperpositionDisplay_labels, invalidateCircuitLabelCache};
