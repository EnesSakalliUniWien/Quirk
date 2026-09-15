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

import {TooltipLayer} from '../../tooltips/TooltipView.js';
import {fitText, fitParagraph} from '../../text/TextLayout.js';
import {rectangle} from '../../shapes/ShapeView.js';

import {Layout} from '../../../config/Layout.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {Point} from '../../../geometry/Point.js';
import {Rect} from '../../../geometry/Rect.js';
import { bin } from "../../../base/Format.js";

/**
 * Reads the outcome selected during simulation; drawing never samples again.
 * @param {!GateRenderParams} args
 * @returns {!{i: !number, p: !number}}
 */
function sampleFromDistribution(args) {
    const pos = args.positionInCircuit;
    return pos === undefined ? {i: 0, p: 1} :
        (args.stats.sampleOutcomes[`${pos.col}:${pos.row}`] ?? {i: 0, p: 0});
}

/**
 * @param {!GateRenderParams} args
 */
function _paintSampleDisplay_result(args) {
    const {painter, rect: {x, y, w, h}} = args;
    const d = Layout.WIRE_SPACING;
    const startY = y + h/2 - d*(args.gate.height-1)/2;
    const rowHeight = Math.min(2 * Layout.GATE_RADIUS, h);

    const {i: sample, p} = sampleFromDistribution(args);
    for (let i = 0; i < args.gate.height; i++) {
        const bit = ((sample >> i) & 1) !== 0;
        if (bit) {
            rectangle(painter, new Rect(x, startY+d*i-rowHeight/2, w, rowHeight), {fill: CanvasTheme.probability.fill});
        }
        fitText(painter, bit ? '1' : '0', {
            x: x+w/2,
            y: startY+d*i,
            align: 'center',
            baseline: 'middle',
            fill: bit ? CanvasTheme.text.onBright : CanvasTheme.text.primary,
            font: {fontSize: 16, fontFamily: Typography.DEFAULT_FONT_FAMILY},
            width: w,
            height: rowHeight
        });
    }

    // The complete bitstring stays in the tooltip when the gate is too narrow to label it legibly.
    const bits = bin(sample, args.gate.height);
    const summary = bits.length <= 3 ? `|${bits}⟩ · ${(p*100).toFixed(1)}%` : `${(p*100).toFixed(1)}%`;
    fitParagraph(painter, summary, new Rect(x, y+h+2, w, 28), {
        alignment: new Point(0.5, 0), fill: CanvasTheme.text.muted,
    });

    for (const pt of args.focusPoints) {
        const k = Math.floor((pt.y - y) * 2 / d) /2;
        if (args.rect.containsPoint(pt)) {
            TooltipLayer.forView(painter).show(painter, {
                x: x + w,
                y: y + k * d,
                labelText: `Sampled |${bin(sample, args.gate.height)}⟩`,
                valueText: `decimal: |${sample}⟩`,
                valueText2: "chance: " + (p * 100).toFixed(4) + "%",
                backColor: CanvasTheme.probability.background
            });
        }
    }
}

/**
 * A sampled measurement outcome is a state readout, so it wears the readout's colours. The display
 * renderer around it draws its frame.
 */
function paintSampleDisplay(args) {
    rectangle(args.painter, args.rect, {fill: CanvasTheme.probability.background});

    const probabilities = args.customStats;
    const noData = probabilities === undefined || probabilities.hasNaN();
    if (noData) {
        fitParagraph(args.painter, "NaN", args.rect, {
            alignment: new Point(0.5, 0.5),
            fill: CanvasTheme.error.text
        });
    } else {
        _paintSampleDisplay_result(args);
    }
}

export {paintSampleDisplay};
