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

import {rectangle, frame, highlightRing} from '../../shapes/ShapeView.js';
import {TooltipLayer} from '../../tooltips/TooltipView.js';
import {fitText} from '../../text/TextLayout.js';
import {Rect} from '../../../geometry/Rect.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';

import {Rectangle} from 'pixi.js';
import {DATA_RENDERERS} from '../../renderers/dataRenderers.js';

/**
 * The multi-qubit probability display: the shared probabilities renderer, fed from the gate's
 * stats. The drawing itself lives in src/draw/renderers/dataRenderers.js, where the panels use it
 * too.
 *
 * @param {!GateRenderParams} args
 */
function paintMultiProbabilityDisplay(args) {
    DATA_RENDERERS.probabilities(args.painter, args.customStats, args.rect, {
        wireCount: args.gate.height,
        focusPoints: args.focusPoints,
    });
}

export {paintMultiProbabilityDisplay};

export function describeProbability(p, fractionalDigits) {
    const v = p * 100;
    const e = Math.pow(10, -fractionalDigits);

    if (v > 100 - e / 2) {
        return "On";
    }
    if (v < e / 2) {
        return "Off";
    }

    return Math.min(Math.max(v, e), 100 - e).toFixed(fractionalDigits) + "%";
}

export function paintProbabilityBox(painter,
                           probability,
                           drawArea,
                           focusPoints = [],
                           backgroundColor = CanvasTheme.probability.background,
                           fillColor = CanvasTheme.probability.fill) {
    rectangle(painter, drawArea, {fill: backgroundColor});
    const cen = drawArea.center();
    if (Number.isNaN(probability)) {
        rectangle(painter, drawArea, {fill: CanvasTheme.error.background});
        fitText(painter, "NaN", {
            x: cen.x,
            y: cen.y,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.error.text,
            font: {fontSize: 12, fontFamily: Typography.DEFAULT_FONT_FAMILY},
            width: drawArea.w,
            height: drawArea.h
        });
    } else {
        rectangle(painter, drawArea.takeBottomProportion(probability), {fill: fillColor});
        fitText(painter, describeProbability(probability, 1), {
            x: cen.x,
            y: cen.y,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.text.primary,
            font: {fontSize: 12, fontFamily: Typography.DEFAULT_FONT_FAMILY},
            width: drawArea.w,
            height: drawArea.h,
            beforeDraw: (w, h) => rectangle(painter, new Rect(cen.x - w/2 - 1, cen.y - h/2, w + 2, h), {fill: CanvasTheme.surface.gate})
        });
    }

    frame(painter, drawArea, CanvasTheme.stroke.displayFrame);

    painter.add('pixiSceneContainer', {
        eventMode: 'static', hitArea: new Rectangle(drawArea.x, drawArea.y, drawArea.w, drawArea.h)
    });

    // Tool tips.
    if (focusPoints.some(pt => drawArea.containsPoint(pt))) {
        highlightRing(painter, drawArea);
        TooltipLayer.forView(painter).show(painter, {
            x: drawArea.right(),
            y: drawArea.y,
            labelText: 'Chance of being ON if measured',
            valueText: (100*probability).toFixed(5) + "%"
        });
    }
}
