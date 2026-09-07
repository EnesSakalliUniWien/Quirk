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

import {PathGeometry} from '../PathGeometry.js';
import {drawPath, rectangle} from '../ShapeView.js';
import {fitText, fitParagraph} from '../TextLayout.js';

import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {MathPainter} from '../../MathPainter.js';
import {Point} from '../../../geometry/Point.js';
import {Rect} from '../../../geometry/Rect.js';
import {Util} from '../../../base/Util.js';

/**
 * @param {!GateDrawParams} args
 * @private
 */
function _paintMultiProbabilityDisplay_grid(args) {
    let {painter, rect: {x, y, w, h}} = args;
    let n = 1 << args.gate.height;
    let d = h / n;
    rectangle(painter, args.rect, {fill: CanvasTheme.probability.background});

    if (d < 1) {
        args.painter.group('dense-grid-' + args.painter.order, painter => {
            painter.alpha *= 0.2;
            rectangle(painter, args.rect, {
                fill: CanvasTheme.stroke.grid
            });
        });
        return;
    }
    let r = args.gate.height - 5;
    drawPath(painter, tracer => {
        for (let i = 1; i < n; i++) {
            PathGeometry.line(tracer, x, y + d * i, x + w, y + d * i);
        }
    }, [{stroke: {color: CanvasTheme.stroke.grid, width: r <= 0 ? 1 : 1 / r}}]);
    rectangle(painter, args.rect, {stroke: {color: CanvasTheme.stroke.grid, width: 1}});
}

function _paintMultiProbabilityDisplay_probabilityBars(args) {
    let {painter, rect: {x, y, w, h}, customStats: probabilities} = args;
    let n = 1 << args.gate.height;
    let d = h / n;
    let e = Math.max(d, 1);

    const path = painter.graphics();
    path.moveTo(x, y);
    for (let i = 0; i < n; i++) {
        let p = probabilities.rawBuffer()[i * 2];
        let px = x + w * p;
        let py = y + d * i;
        path.lineTo(px, py);
        path.lineTo(px, py + e);
    }
    path.lineTo(x, y + h);
    path.lineTo(x, y);

    path.stroke({color: CanvasTheme.stroke.guide, width: 1}).fill(CanvasTheme.probability.fill);

}

function _paintMultiProbabilityDisplay_logarithmHints(args) {
    let {painter, rect: {x, y, w, h}, customStats: probabilities} = args;
    let n = 1 << args.gate.height;
    let d = h / n;
    let e = Math.max(d, 1);

    const path = painter.graphics();
    path.moveTo(x, y);
    let s = 1 / (4 + Math.max(8, args.gate.height));
    for (let i = 0; i < n; i++) {
        let p = probabilities.rawBuffer()[i * 2];
        let px = x + w * Math.min(1, Math.max(0, 1 + Math.log(p) * s));
        let py = y + d * i;
        path.lineTo(px, py);
        path.lineTo(px, py + e);
    }
    path.lineTo(x, y + h);

    path.stroke({color: CanvasTheme.stroke.faint, width: 1});

}

function _paintMultiProbabilityDisplay_tooltips(args) {
    let {painter, rect: {x, y, w, h}, customStats: probabilities} = args;
    let n = 1 << args.gate.height;
    let d = h / n;

    for (let pt of args.focusPoints) {
        let k = Math.floor((pt.y - y) / d);
        if (args.rect.containsPoint(pt) && k >= 0 && k < n) {
            let p = probabilities === undefined ? NaN : probabilities.rawBuffer()[k * 2];
            rectangle(painter, new Rect(x, y + k * d, w, d), {stroke: {color: CanvasTheme.interaction.outline, width: 2}});
            MathPainter.paintDeferredValueTooltip(
                painter,
                x + w,
                y + k * d,
                `Chance of |${Util.bin(k, args.gate.height)}⟩ (decimal ${k}) if measured`,
                'raw: ' + (p * 100).toFixed(4) + "%",
                'log: ' + (Math.log10(p) * 10).toFixed(1) + " dB");
        }
    }
}

function _paintMultiProbabilityDisplay_probabilityTexts(args) {
    let {painter, rect: {x, y, w, h}, customStats: probabilities} = args;
    let d = h / probabilities.height();

    for (let i = 0; i < probabilities.height(); i++) {
        let p = probabilities.rawBuffer()[i * 2];
        fitText(painter, (p * 100).toFixed(1) + "%", {
            x: x + w - 2,
            y: y + d * (i + 0.5),
            align: 'right',
            baseline: 'middle',
            fill: CanvasTheme.text.primary,
            font: {fontSize: 10.666666666666666, fontFamily: Typography.MONO_FONT_FAMILY},
            width: w - 4,
            height: d
        });
    }
}

function paintMultiProbabilityDisplay(args) {
    _paintMultiProbabilityDisplay_grid(args);

    let probabilities = args.customStats;
    let noData = probabilities === undefined || probabilities.hasNaN();
    if (noData) {
        fitParagraph(args.painter, "NaN", args.rect, {
            alignment: new Point(0.5, 0.5),
            fill: CanvasTheme.error.text
        });
    } else {
        let textFits = args.rect.h / probabilities.height() > 8;
        if (!textFits) {
            _paintMultiProbabilityDisplay_logarithmHints(args);
        }
        _paintMultiProbabilityDisplay_probabilityBars(args);
        if (textFits) {
            _paintMultiProbabilityDisplay_probabilityTexts(args);
        }
    }

    _paintMultiProbabilityDisplay_tooltips(args);
}

export {paintMultiProbabilityDisplay};
