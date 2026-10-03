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

import {lineWidth, rectangle, strokePath} from '../../../draw/shapes/ShapeView.js';
import {fitText} from '../../../draw/text/TextLayout.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Layout} from '../../../config/Layout.js';
import {Typography} from '../../../config/Typography.js';
import {Point} from '../../../geometry/Point.js';
import {Rect} from '../../../geometry/Rect.js';

/**
 * Where each input letter's link runs, beside the column's centre: apart from a control's line on
 * the centre, and from each other, so A and B into one gate read as two links, not one chain.
 */
const INPUT_LINK_OFFSETS = Object.freeze({A: -5, B: 5, R: 10});
const INPUT_LINK_FONT = {fontSize: 11, fontFamily: Typography.MONO_FONT_FAMILY};

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

    for (const {first, last, measured, letter, readerFirst, readerLast} of context.definition.controlLinesRanges(columnIndex)) {
        const y1 =  context.geometry.wireRect(first).center().y;
        const y2 = context.geometry.wireRect(last).center().y;
        const w = lineWidth(painter, 1);
        // A control's line is the bright ink on the centre; an input's is data, in the guide's
        // quieter ink and beside the centre, labelled with the letter it carries.
        const lx = letter === undefined ? x : x + (INPUT_LINK_OFFSETS[letter] ?? 0);
        const ink = letter === undefined ? CanvasTheme.text.primary : CanvasTheme.stroke.guide;
        if (measured) {
            strokePath(painter, [new Point(lx+w, y1), new Point(lx+w, y2)], CanvasTheme.iqp.classicalWire, w);
            strokePath(painter, [new Point(lx-w, y1), new Point(lx-w, y2)], CanvasTheme.iqp.classicalWire, w);
        } else {
            strokePath(painter, [new Point(lx, y1), new Point(lx, y2)], ink, w);
        }
        if (letter !== undefined) {
            // The letter stands at the reader's edge facing its input, clear of both tiles.
            const fromAbove = readerFirst > first;
            const edge = fromAbove ?
                context.geometry.wireRect(readerFirst).center().y - Layout.GATE_RADIUS - 8 :
                context.geometry.wireRect(readerLast).center().y + Layout.GATE_RADIUS + 8;
            fitText(painter, letter, {
                x: lx,
                y: edge,
                align: 'center',
                baseline: 'middle',
                fill: CanvasTheme.text.muted,
                font: INPUT_LINK_FONT,
                width: 14,
                height: 14,
                beforeDraw: (tw, th) => rectangle(painter,
                    new Rect(lx - tw / 2 - 2, edge - th / 2 - 1, tw + 4, th + 2), {fill: CanvasTheme.surface.background}),
            });
        }
    }
}

export {drawColumnControlWires};
