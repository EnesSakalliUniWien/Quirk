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

import {drawPath, rectangle} from '../ShapeView.js';
import {PathGeometry} from '../PathGeometry.js';
import {fitText} from '../TextLayout.js';

/** @typedef {import('../DisplayView.js').DisplayView} DisplayView */

import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';

import {Format} from '../../../base/Format.js';
import {Util} from '../../../base/Util.js';
import {MathPainter} from '../../MathPainter.js';

/**
 * @param {!DisplayView} painter
 * @param {!Matrix} matrix
 * @param {!Rect} drawArea
 * @param {!Array.<!Point>} focusPoints
 * @param {!string=} backgroundColor
 * @param {!string=} fillColor
 */
export function paintDensityMatrix(painter,
                              matrix,
                              drawArea,
                              focusPoints = [],
                              backgroundColor = CanvasTheme.probability.background,
                              fillColor = CanvasTheme.probability.fill) {
        const numCols = matrix.width();
        const numRows = matrix.height();
        const buf = matrix.rawBuffer();
        const diam = Math.min(drawArea.w / numCols, drawArea.h / numRows);
        const x = drawArea.x;
        const y = drawArea.y;
        const hasNaN = matrix.hasNaN();

        const traceCouplingsWith = cellTraceFunc => trace => {
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numCols; col++) {
                    const k = (row * numCols + col) * 2;
                    cellTraceFunc(
                        trace,
                        buf[k],
                        buf[k + 1],
                        x + diam * col,
                        y + diam * row,
                        diam);
                }
            }
        };

        const traceDiagonalWith = cellTraceFunc => trace => {
            for (let col = 0; col < numRows; col++) {
                const k = col * (numCols + 1) * 2;
                cellTraceFunc(
                    trace,
                    buf[k],
                    buf[k + 1],
                    x + diam * col,
                    y + diam * col,
                    diam);
            }
        };

        rectangle(painter, drawArea, {fill: backgroundColor});

        if (!hasNaN) {
            drawPath(painter, traceDiagonalWith(MathPainter._traceProbabilitySquare), [{fill: fillColor}, {stroke: {color: CanvasTheme.probability.outline, width: 0.5}}]);

            drawPath(painter, traceCouplingsWith(MathPainter._traceAmplitudeProbabilityCircle), [{fill: fillColor}, {stroke: {color: CanvasTheme.probability.outline, width: 0.5}}]);

            drawPath(painter, traceCouplingsWith(MathPainter._traceAmplitudeLogarithmCircle), [{stroke: {color: CanvasTheme.stroke.faint, width: 0.5}}]);

            drawPath(painter, traceCouplingsWith(MathPainter._traceAmplitudePhaseDirection), [{stroke: {color: CanvasTheme.amplitude.phaseHalo, width: 3}}, {stroke: {color: CanvasTheme.text.primary, width: 1}}]);
        }

        // Dividers.
        const d = drawArea.w/numCols;
        if (d > 2) {
            drawPath(painter, trace => PathGeometry.grid(trace, x, y, drawArea.w, drawArea.h, numCols, numRows), [{stroke: {color: CanvasTheme.amplitude.phaseHalo, width: 3}}, {stroke: {color: CanvasTheme.stroke.grid, width: Math.min(1, 2/Math.log(numCols))}}]);
        } else {
           painter.group('dense-grid-' + painter.order, painter => {
               painter.alpha *= 0.2;
               rectangle(painter, drawArea, {
                   fill: CanvasTheme.stroke.grid
               });
           });
        }

        if (hasNaN) {
            fitText(painter, 'NaN', {
                x: drawArea.x + drawArea.w/2,
                y: drawArea.y + drawArea.h/2,
                align: 'center',
                baseline: 'middle',
                fill: CanvasTheme.error.text,
                font: {fontSize: 16, fontFamily: Typography.DEFAULT_FONT_FAMILY},
                width: drawArea.w,
                height: drawArea.h
            });
        }

        const n = Math.round(Math.log2(numRows));
        MathPainter.paintMatrixTooltip(painter, matrix, drawArea, focusPoints,
            (c, r) => c === r ?
                `Probability of |${Util.bin(c, n)}⟩ (decimal ${c})` :
                `Coupling of |${Util.bin(r, n)}⟩ to ⟨${Util.bin(c, n)}| (decimal ${r} to ${c})`,
            (c, r, v) => c === r ?
                (matrix.cell(c, r).real*100).toFixed(4) + "%" :
                matrix.cell(c, r).toString(new Format(false, 0, 6, ", ")));
    }
