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

import {fitText, fitParagraph} from '../TextLayout.js';
import {rectangle} from '../ShapeView.js';

import {Layout} from '../../../config/Layout.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {MathPainter} from '../../MathPainter.js';
import {Point} from '../../../geometry/Point.js';
import {Rect} from '../../../geometry/Rect.js';
import {Util} from '../../../base/Util.js';

/**
 * Looks up the simulated probability distribution and samples from it using the current graphics PRNG.
 * @param {!GateDrawParams} args
 * @returns {!{i: !number, p: !number}}
 */
function sampleFromDistribution(args) {
    let probabilities = args.customStats;
    let buf = probabilities.rawBuffer();
    let r = args.painter.rng.random();
    let n = probabilities.height();
    for (let i = 0; ; i++) {
        let p = buf[i*2];
        r -= p;
        if (i === n-1 || r < 0.00001) {
            return {i, p};
        }
    }
}

/**
 * @param {!GateDrawParams} args
 */
function _paintSampleDisplay_result(args) {
    let {painter, rect: {x, y, w, h}} = args;
    let d = Layout.WIRE_SPACING;
    let startY = y + h/2 - d*args.gate.height/2;

    let {i: sample, p} = sampleFromDistribution(args);
    for (let i = 0; i < args.gate.height; i++) {
        let bit = ((sample >> i) & 1) !== 0;
        if (bit) {
            rectangle(painter, new Rect(x, startY+d*i+5, w, d-10), {fill: CanvasTheme.operation.fill});
        }
        fitText(painter, bit ? 'on' : 'off', {
            x: x+w/2,
            y: startY+d*(i+0.5),
            align: 'center',
            baseline: 'middle',
            fill: bit ? CanvasTheme.text.onBright : CanvasTheme.text.primary,
            font: {fontSize: 16, fontFamily: Typography.DEFAULT_FONT_FAMILY},
            width: w,
            height: d
        });
    }

    for (let pt of args.focusPoints) {
        let k = Math.floor((pt.y - y) * 2 / d) /2;
        if (args.rect.containsPoint(pt)) {
            MathPainter.paintDeferredValueTooltip(
                painter,
                x + w,
                y + k * d,
                `Sampled |${Util.bin(sample, args.gate.height)}⟩`,
                `decimal: |${sample}⟩`,
                "chance: " + (p * 100).toFixed(4) + "%",
                CanvasTheme.operation.background);
        }
    }
}

function paintSampleDisplay(args) {
    rectangle(args.painter, args.rect, {fill: CanvasTheme.operation.background});

    let probabilities = args.customStats;
    let noData = probabilities === undefined || probabilities.hasNaN();
    if (noData) {
        fitParagraph(args.painter, "NaN", args.rect, {
            alignment: new Point(0.5, 0.5),
            fill: CanvasTheme.error.text
        });
    } else {
        _paintSampleDisplay_result(args);
    }

    rectangle(args.painter, args.rect, {stroke: {color: CanvasTheme.stroke.grid, width: 1}});
}

export {paintSampleDisplay};
