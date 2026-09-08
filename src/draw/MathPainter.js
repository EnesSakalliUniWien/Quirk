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

import {PathGeometry} from './pixi/PathGeometry.js';
import {drawPath, rectangle, circle, strokePath} from './pixi/ShapeView.js';
import {TooltipLayer} from './pixi/TooltipView.js';
import {fitText} from './pixi/TextLayout.js';

/** @typedef {import('./pixi/DisplayView.js').DisplayView} DisplayView */

import {Point} from '../geometry/Point.js';
import {Rect} from '../geometry/Rect.js';
import {seq} from '../base/Seq.js';

import {CanvasTheme} from '../config/CanvasTheme.js';
import {Typography} from '../config/Typography.js';

import {Matrix} from '../engine/math/matrix/Matrix.js';
import {QubitMatrix} from '../engine/math/matrix/QubitMatrix.js';

class MathPainter {
    static describeProbability(p, fractionalDigits) {
        let v = p * 100;
        let e = Math.pow(10, -fractionalDigits);

        if (v > 100 - e / 2) {
            return "On";
        }
        if (v < e / 2) {
            return "Off";
        }

        return Math.min(Math.max(v, e), 100 - e).toFixed(fractionalDigits) + "%";
    }

    /**
     * @param {!DisplayView} painter
     * @param {!number} probability
     * @param {!Rect} drawArea
     * @param {!Array.<!Point>=} focusPoints
     * @param {!string=} backgroundColor
     * @param {!string=} fillColor
     */
    static paintProbabilityBox(painter,
                               probability,
                               drawArea,
                               focusPoints = [],
                               backgroundColor = CanvasTheme.probability.background,
                               fillColor = CanvasTheme.probability.fill) {
        rectangle(painter, drawArea, {fill: backgroundColor});
        let cen = drawArea.center();
        if (isNaN(probability)) {
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
            fitText(painter, MathPainter.describeProbability(probability, 1), {
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

        rectangle(painter, drawArea, {stroke: {color: CanvasTheme.stroke.grid, width: 1}});

        // Tool tips.
        if (focusPoints.some(pt => drawArea.containsPoint(pt))) {
            rectangle(painter, drawArea, {stroke: {color: CanvasTheme.interaction.outline, width: 2}});
            MathPainter.paintDeferredValueTooltip(
                painter,
                drawArea.right(),
                drawArea.y,
                'Chance of being ON if measured',
                (100*probability).toFixed(5) + "%");
        }
    }

    /**
     * @param {!DisplayView} painter
     * @param {!Matrix} matrix The matrix to draw.
     * @param {!Rect} drawArea The rectangle to draw the matrix within.
     * @param {!Array.<!Point>} focusPoints
     * @param {!function(!int, !int) : !string} titleFunc
     * @param {!function(!int, !int, !Complex) : !string} valueTextFunc1
     * @param {(!function(!int, !int, !Complex) : (undefined|!string))=} valueTextFunc2
     */
    static paintMatrixTooltip(
            painter,
            matrix,
            drawArea,
            focusPoints,
            titleFunc,
            valueTextFunc1,
            valueTextFunc2 = () => undefined) {
        let numCols = matrix.width();
        let numRows = matrix.height();
        let {x, y} = drawArea;
        let diam = Math.min(drawArea.w / numCols, drawArea.h / numRows);
        for (let pt of focusPoints) {
            let c = Math.floor((pt.x - x) / diam);
            let r = Math.floor((pt.y - y) / diam);
            if (c >= 0 && c < matrix.width() && r >= 0 && r < matrix.height()) {
                rectangle(painter, new Rect(x + diam*c, y + diam*r, diam, diam), {stroke: {color: CanvasTheme.interaction.outline, width: 2}});
                let v = matrix.cell(c, r);
                MathPainter.paintDeferredValueTooltip(
                    painter,
                    x + diam*c + diam,
                    y + diam*r,
                    titleFunc(c, r),
                    valueTextFunc1(c, r, v),
                    valueTextFunc2(c, r, v));
            }
        }
    }

    /**
     * @param {!GraphicsPath} trace
     * @param {!number} real
     * @param {!number} imag
     * @param {!number} x
     * @param {!number} y
     * @param {!number} d
     * @private
     */
    static _traceAmplitudeProbabilitySquare(trace, real, imag, x, y, d) {
        let p = real*real + imag*imag;
        if (p > 0.001) {
            trace.poly([
                x, y + d * (1 - p),
                x + d, y + d * (1 - p),
                x + d, y + d,
                x, y + d]);
        }
    }

    /**
     * @param {!GraphicsPath} trace
     * @param {!number} real
     * @param {!number} imag
     * @param {!number} x
     * @param {!number} y
     * @param {!number} d
     * @private
     */
    static _traceProbabilitySquare(trace, real, imag, x, y, d) {
        let p = real;
        if (d*p > 0.1) {
            trace.poly([
                x, y + d * (1 - p),
                x + d, y + d * (1 - p),
                x + d, y + d,
                x, y + d]);
        }
    }

    /**
     * @param {!GraphicsPath} trace
     * @param {!number} real
     * @param {!number} imag
     * @param {!number} x
     * @param {!number} y
     * @param {!number} d
     * @private
     */
    static _traceAmplitudeProbabilityCircle(trace, real, imag, x, y, d) {
        let mag = Math.sqrt(real*real + imag*imag);
        if (d*mag > 0.5) {
            trace.circle(x+d/2, y+d/2, mag*d/2);
        }
    }

    /**
     * @param {!GraphicsPath} trace
     * @param {!number} real
     * @param {!number} imag
     * @param {!number} x
     * @param {!number} y
     * @param {!number} d
     * @private
     */
    static _traceAmplitudeLogarithmCircle(trace, real, imag, x, y, d) {
        let g = 1 + Math.log(real*real + imag*imag)/15;
        if (g > 0) {
            trace.circle(x+d/2, y+d/2, g*d/2);
        }
    }

    /**
     * @param {!GraphicsPath} trace
     * @param {!number} real
     * @param {!number} imag
     * @param {!number} x
     * @param {!number} y
     * @param {!number} d
     * @private
     */
    static _traceAmplitudePhaseDirection(trace, real, imag, x, y, d) {
        let mag = Math.sqrt(real*real + imag*imag);
        if (mag === 0) return;
        let g = 1 + Math.log(mag)/10;
        let r = Math.max(1, g/mag)*Math.max(d/2, 5);
        if (r < 0.1) {
            return;
        }
        let cx = x + d/2;
        let cy = y + d/2;
        PathGeometry.line(trace, cx, cy, cx + real*r, cy - imag*r);
    }

    /**
     * Draws a visual representation of a complex matrix.
     * @param {!DisplayView} painter
     * @param {!Matrix} matrix The matrix to draw.
     * @param {!Rect} drawArea The rectangle to draw the matrix within.
     * @param {undefined|!string} amplitudeCircleFillColor
     * @param {!string} amplitudeCircleStrokeColor
     * @param {undefined|!string} amplitudeProbabilityFillColor
     * @param {undefined|!string=} backColor
     * @param {(!function(!number): (undefined|!string))=} phaseColorForDegrees
     * @param {undefined|!string=} logCircleStrokeColor
     */
    static paintMatrix(painter,
                       matrix,
                       drawArea,
                       amplitudeCircleFillColor,
                       amplitudeCircleStrokeColor,
                       amplitudeProbabilityFillColor,
                       backColor = CanvasTheme.probability.background,
                       phaseColorForDegrees = () => amplitudeCircleStrokeColor,
                       logCircleStrokeColor = CanvasTheme.stroke.faint) {
        let numCols = matrix.width();
        let numRows = matrix.height();
        let buf = matrix.rawBuffer();
        let diam = Math.min(drawArea.w / numCols, drawArea.h / numRows);
        drawArea = drawArea.withW(diam * numCols).withH(diam*numRows);
        let {x, y} = drawArea;
        let hasNaN = matrix.hasNaN();

        rectangle(painter, drawArea, {fill: backColor});

        let traceCellsWith = cellTraceFunc => trace => {
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numCols; col++) {
                    let k = (row * numCols + col) * 2;
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

        if (!hasNaN) {
            // Squared magnitude levels.
            if (amplitudeProbabilityFillColor !== undefined) {
                drawPath(painter, traceCellsWith(MathPainter._traceAmplitudeProbabilitySquare), [{fill: amplitudeProbabilityFillColor}, {stroke: {color: CanvasTheme.stroke.grid, width: 0.5}}]);
            }

            // Circles.
            if (amplitudeCircleFillColor !== undefined) {
                drawPath(painter, traceCellsWith(MathPainter._traceAmplitudeProbabilityCircle), [{fill: amplitudeCircleFillColor}, {stroke: {color: amplitudeCircleStrokeColor, width: 0.5}}]);

                drawPath(painter, traceCellsWith(MathPainter._traceAmplitudeLogarithmCircle), [{stroke: {color: logCircleStrokeColor, width: 0.5}}]);
            }
        }

        // Dividers.
        drawPath(painter, trace => PathGeometry.grid(trace, x, y, drawArea.w, drawArea.h, numCols, numRows), [{stroke: {color: CanvasTheme.amplitude.phaseHalo, width: 3}}, {stroke: {color: CanvasTheme.stroke.grid, width: 1}}]);

        if (!hasNaN) {
            // Phase lines.
            if (logCircleStrokeColor !== undefined) {
                // Group equal colours so a large monochrome matrix still uses one canvas path.
                const cellsByColor = new Map();
                for (let k = 0; k < buf.length; k += 2) {
                    if (buf[k] === 0 && buf[k + 1] === 0) continue;
                    const color = phaseColorForDegrees(Math.atan2(buf[k + 1], buf[k]) * 180 / Math.PI);
                    if (color === undefined) continue;
                    if (!cellsByColor.has(color)) cellsByColor.set(color, []);
                    cellsByColor.get(color).push(k);
                }
                for (const [color, cells] of cellsByColor) {
                    drawPath(painter, trace => {
                        for (const k of cells) {
                            const row = Math.floor(k / 2 / numCols), col = k / 2 % numCols;
                            MathPainter._traceAmplitudePhaseDirection(trace, buf[k], buf[k + 1],
                                x + diam * col, y + diam * row, diam);
                        }
                    }, [{stroke: {color: CanvasTheme.amplitude.phaseHalo, width: 3}}, {stroke: {color: color, width: 1}}]);
                }
            }
        }

        // Error text.
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
    }

    /**
     * @param {!DisplayView} painter
     * @param {!number} x
     * @param {!number} y
     * @param {!string} labelText
     * @param {!string} valueText
     * @param {undefined|!string=} valueText2
     * @param {!string=} backColor
     */
    static paintDeferredValueTooltip(painter, x, y, labelText, valueText, valueText2, backColor = CanvasTheme.probability.background) {
        TooltipLayer.forView(painter).show(painter, {x, y, labelText, valueText, valueText2, backColor});
    }

    /**
     * @param {!number} unit
     * @returns {!{dx: !Point, dy: !Point, dz: !Point}}
     */
    static coordinateSystem(unit) {
        return {
            dx: new Point(unit / 3, -unit / 3),
            dy: new Point(unit, 0),
            dz: new Point(0, unit)
        };
    }

    /**
     * @param {!DisplayView} painter
     * @param {!Matrix} operation
     * @param {!Rect} drawArea
     * @param {!string=} backgroundColor
     * @param {!string=} fillColor
     */
    static paintBlochSphereRotation(painter,
                                    operation,
                                    drawArea,
                                    backgroundColor = CanvasTheme.probability.background,
                                    fillColor = CanvasTheme.probability.fill) {
        let c = drawArea.center();
        let u = Math.min(drawArea.w, drawArea.h) / 2;
        let {dx, dy, dz} = MathPainter.coordinateSystem(u);
        let projMatrix = Matrix.fromRows([
            [-dx.x, -dx.y],
            [dy.x, dy.y],
            [-dz.x, -dz.y],
        ]).adjoint();
        let projToPt = col => {
            let p = projMatrix.times(col);
            return new Point(p.cell(0, 0).real, p.cell(0, 1).real)
        };
        let axes = Array.from({length: 3}, (_, i) => Matrix.generate(1, 3, (r, _) => r === i ? 1 : 0));

        // Draw sphere and axis lines (in not-quite-proper 3d).
        circle(painter, c, u, {fill: backgroundColor});
        drawPath(painter, trace => {
            trace.circle(c.x, c.y, u);
            trace.ellipse(c.x, c.y, u, u / 3);
            trace.ellipse(c.x, c.y, u / 3, u);
            for (let a of axes) {
                let d = projToPt(a);
                PathGeometry.line(trace, c.x - d.x, c.y - d.y, c.x + d.x, c.y + d.y);
            }
        }, [{stroke: {color: CanvasTheme.stroke.faint, width: 1}}]);

        let {angle, axis} = QubitMatrix.operationToAngleAxisRotation(operation);
        let axisVec = Matrix.col(...axis);
        let dAxis = projToPt(axisVec);

        // Disambiguating 3d guide lines for axis, forming vertical rectangles.
        let guideDeltas = [
            Matrix.col(axis[0], axis[1], 0),
            axisVec,
            Matrix.col(0, 0, axis[2])
        ].map(projToPt);
        // Down one side of the rectangles and back up the other, closed by repeating the last point first.
        let guidePath = guideDeltas.
            toReversed().
            concat(guideDeltas.map(d => d.times(-1))).
            map(d => c.plus(d));
        strokePath(
            painter,
            guidePath.length === 0 ? [] : [guidePath.at(-1), ...guidePath],
            CanvasTheme.text.muted,
            1);
        // Rotation axis.
        strokePath(painter, [c.plus(dAxis), c.plus(dAxis.times(-1))], CanvasTheme.text.primary, 2);

        // Find perpendicular axes, for drawing the rotation arrow circles.
        let norm = e => Math.sqrt(e.adjoint().times(e).cell(0, 0).real);
        let perpVec1 = seq(axes.
            map((a, i) => a.times([-3, -2, 1][i])). // Prioritize/orient axes to look good.
            map(a => axisVec.cross3(a))).
            maxBy(norm);
        let perpVec2 = axisVec.cross3(perpVec1);
        perpVec1 = perpVec1.times(0.15 / norm(perpVec1));
        perpVec2 = perpVec2.times(0.15 / norm(perpVec2));
        let dPerp1 = projToPt(perpVec1);
        let dPerp2 = projToPt(perpVec2);

        MathPainter._paintBlochSphereRotation_rotationGuideArrows(painter, c, angle, dAxis, dPerp1, dPerp2, fillColor);
    }

    /**
     * @param {!DisplayView} painter
     * @param {!Point} center
     * @param {!number} angle
     * @param {!Point} dAlong
     * @param {!Point} dPerp1
     * @param {!Point} dPerp2
     * @param {!string} fillColor
     * @private
     */
    static _paintBlochSphereRotation_rotationGuideArrows(painter, center, angle, dAlong, dPerp1, dPerp2, fillColor) {
        // Compute the rotation arc.
        let rotationGuideDeltas = Array.from(
            {length: Math.floor(Math.abs(angle) * 32)},
            (_, i) => {
                let θ = (angle < 0 ? Math.PI - i / 32 : i / 32);
                return dPerp1.times(Math.cos(θ)).
                    plus(dPerp2.times(Math.sin(θ)));
            });

        if (rotationGuideDeltas.length <= 1) {
            return;
        }

        // Draw the three rotation guides.
        for (let offsetFactor of [-0.55, 0, 0.55]) {
            let offsetCenter = center.plus(dAlong.times(offsetFactor));
            let arcPts = rotationGuideDeltas.map(d => offsetCenter.plus(d));
            let arrowHeadRoot = arcPts[arcPts.length - 1];
            let arrowHeadDirection = arrowHeadRoot.plus(arcPts[arcPts.length - 2].times(-1));
            let arrowHeadPts = [
                dAlong.times(0.15),
                arrowHeadDirection.times(30),
                dAlong.times(-0.15)
            ].map(d => arrowHeadRoot.plus(d));
            let interleaved = [].concat.apply([], arrowHeadPts.map(e => [e.x, e.y]));

            strokePath(painter, arcPts, CanvasTheme.stroke.bright, 1);
            drawPath(painter, tracer => tracer.poly(interleaved), [{fill: fillColor}, {stroke: {color: CanvasTheme.stroke.bright, width: 1}}]);
        }
    }

}

export {MathPainter}
