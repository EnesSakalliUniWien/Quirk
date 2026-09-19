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
import {fitText, fitParagraph} from '../../../draw/text/TextLayout.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {Point} from '../../../geometry/Point.js';
import {Gate} from '../../../circuit/model/Gate.js';
/** @typedef {import('../../../geometry/Rect.js').Rect} Rect */

/**
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!int} col
 * @param {!int} row
 * @param {!Rect} gateRect
 */
function drawGate_disabledReason(context, painter, col, row, gateRect) {
    const isDisabledReason = context.definition.gateAtLocIsDisabledReason(col, row);
    if (isDisabledReason === undefined) {
        return;
    }
    if (isDisabledReason === Gate.DEACTIVATED_REASON) {
        drawGate_deactivated(painter, gateRect);
        return;
    }

    // Keep the reason opaque and readable, including while the disabled gate is hovered.
    const area = gateRect.paddedBy(5);
    rectangle(painter, area, {fill: CanvasTheme.error.background});
    rectangle(painter, area, {stroke: {color: CanvasTheme.error.text, width: 1}});
    fitParagraph(painter, isDisabledReason, area, {
        alignment: new Point(0.5, 0.5),
        fill: CanvasTheme.error.text
    });
}

/**
 * A gate switched off from its menu is not a mistake, so it wears no warning: a veil of the
 * circuit's background dims it in its slot, and a small "off" says why it does nothing.
 * @param {!DisplayView} painter
 * @param {!Rect} gateRect
 */
function drawGate_deactivated(painter, gateRect) {
    painter.group('deactivated-' + painter.order, veil => {
        veil.alpha *= 0.62;
        rectangle(veil, gateRect.paddedBy(1), {fill: CanvasTheme.surface.background});
    });
    rectangle(painter, gateRect, {stroke: {color: CanvasTheme.text.muted, width: 1}});
    fitText(painter, 'off', {
        x: gateRect.x + 3,
        y: gateRect.y + 2,
        align: 'left',
        baseline: 'top',
        fill: CanvasTheme.text.muted,
        font: {fontSize: 10, fontFamily: Typography.MONO_FONT_FAMILY},
        width: gateRect.w - 6,
        height: 12
    });
}

/**
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!GateColumn} gateColumn
 * @param {!int} col
 * @param {!CircuitStats} stats
 */
function drawColumnSurvivalRate(context, painter, gateColumn, col, stats) {
    if (gateColumn.indexOfNonUnitaryGate() === undefined) {
        return;
    }

    const preRate = stats.survivalRate(col - 1);
    const postRate = stats.survivalRate(col);

    const marginalRate = (postRate - preRate) / preRate;
    if (Number.isNaN(marginalRate) || Math.abs(marginalRate) <= 0.005) {
        return;
    }

    let descAmount;
    let descCategory;
    if (marginalRate < 0) {
        const rate = Math.round(-marginalRate * 100);
        const rateDesc = marginalRate === -1 ? "100" : rate < 100 ? rate : ">99";
        descAmount = `${rateDesc}%`;
        descCategory = 'omits';
    } else {
        const factor = Math.round(marginalRate * 100 + 100);
        descAmount = `${factor}%`;
        descCategory = 'gains';
    }

    const pt = context.geometry.opRect(col).bottomCenter();
    fitText(painter, descCategory, {
        x: pt.x,
        y: pt.y - 28,
        align: 'center',
        baseline: 'bottom',
        fill: CanvasTheme.error.text,
        font: {fontSize: 14, fontFamily: Typography.DEFAULT_FONT_FAMILY},
        width: 800,
        height: 50
    });
    fitText(painter, descAmount, {
        x: pt.x,
        y: pt.y - 13,
        align: 'center',
        baseline: 'bottom',
        fill: CanvasTheme.error.text,
        font: {fontSize: 14, fontFamily: Typography.DEFAULT_FONT_FAMILY},
        width: 800,
        height: 50
    });
}

export {drawGate_disabledReason, drawColumnSurvivalRate};
