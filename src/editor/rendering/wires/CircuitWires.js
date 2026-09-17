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

import {PathGeometry} from '../../../draw/shapes/PathGeometry.js';
import {drawPath, lineWidth, strokePath} from '../../../draw/shapes/ShapeView.js';
import {fitText} from '../../../draw/text/TextLayout.js';
import {Layout} from '../../../config/Layout.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Simulation} from '../../../config/Simulation.js';
import {Typography} from '../../../config/Typography.js';
import {Point} from '../../../geometry/Point.js';
import {drawWireLabels} from './CircuitGutter.js';

/**
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!boolean} showLabels
 * @param {!PointerInteractionState} hand
 */
function drawWires(context, painter, showLabels, hand) {
    const drawnWireCount = Math.min(context.definition.numWires, (context.geometry.extraWireStartIndex || Infinity) + 1);

    if (showLabels) {
        drawWireLabels(context, painter, hand, drawnWireCount);
    }

    // Wires (doubled-up for measured sections).
    for (let row = 0; row < drawnWireCount; row++) {
        painter.group('wire-' + row, painter => {
            painter.alpha = row >= context.geometry.extraWireStartIndex ? 0.5 : 1;
            const segments = [[], []];
            // A measured wire's double line keeps its gap when zoomed out, as its width does.
            const gap = lineWidth(painter, 1);
            const wireRect = context.geometry.wireRect(row);
            const y = Math.round(wireRect.center().y - 0.5) + 0.5;
            let lastX = showLabels ? context.geometry.wireInitialStateRect(row).right() : 5;
            // Wires terminate before the superposition display's row labels instead of running to the
            // canvas's right edge.
            const wireEndX = showLabels ? context.geometry.outputWireEndX() : Infinity;
            for (let col = 0; showLabels ? lastX < wireEndX : col <= context.definition.columns.length; col++) {
                const x = Math.min(context.geometry.opRect(col).center().x, wireEndX);
                if (context.definition.locIsMeasured(new Point(col, row))) {
                    // Measured wire.
                    segments[1].push([lastX, y - gap, x, y - gap]);
                    segments[1].push([lastX, y + gap, x, y + gap]);
                } else {
                    // Unmeasured wire.
                    segments[0].push([lastX, y, x, y]);
                }
                lastX = x;
            }
            for (const [i, color] of [CanvasTheme.text.primary, CanvasTheme.iqp.classicalWire].entries()) {
                drawPath(painter, trace => segments[i].forEach(segment => PathGeometry.line(trace, ...segment)), [{
                    stroke: {
                        color: color,
                        width: lineWidth(painter, 1)
                    }
                }]);
            }
        });
    }

    // A faint stub under the last wire advertises that dragging a gate below the circuit adds a
    // qubit. While a drag is showing the real preview wire, the hint gets out of the way.
    if (showLabels &&
            context.geometry.extraWireStartIndex === undefined &&
            context.definition.numWires < Simulation.MAX_WIRE_COUNT) {
        const hintY = Math.round(context.geometry.wireRect(drawnWireCount).center().y - 0.5) + 0.5;
        const hintRect = context.geometry.wireInitialStateRect(drawnWireCount);
        painter.group('wire-hint-' + painter.order, painter => {
            strokePath(painter, [new Point(hintRect.right(), hintY), new Point(context.geometry.opRect(1).right(), hintY)], CanvasTheme.stroke.faint, 1, [4, 4]);
        });
        fitText(painter, '+', {
            x: hintRect.center().x,
            y: hintY,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.stroke.faint,
            font: {fontSize: Layout.REGISTER_FONT_SIZE, fontFamily: Typography.DEFAULT_FONT_FAMILY},
            width: hintRect.w,
            height: hintRect.h
        });
    }

    if (context.geometry.extraWireStartIndex !== undefined && context.definition.numWires === Simulation.MAX_WIRE_COUNT) {
        fitText(painter, `(Max wires. Qubit limit is ${Simulation.MAX_WIRE_COUNT}.)`, {
            x: 5,
            y: context.geometry.wireRect(Simulation.MAX_WIRE_COUNT).y,
            align: 'left',
            baseline: 'top',
            fill: CanvasTheme.error.text,
            font: {fontSize: 16, fontFamily: Typography.MONO_FONT_FAMILY, fontWeight: 'bold'},
            width: 400,
            height: Layout.WIRE_SPACING
        });
    }
}

export {drawWires};
