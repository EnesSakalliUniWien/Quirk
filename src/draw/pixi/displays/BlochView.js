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
import {circle, strokePath, rectangle} from '../ShapeView.js';

/** @typedef {import('../DisplayView.js').DisplayView} DisplayView */

import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Layout} from '../../../config/Layout.js';
import {MathPainter} from '../../MathPainter.js';
import {Point} from '../../../geometry/Point.js';
import {Rect} from '../../../geometry/Rect.js';
import {Typography} from '../../../config/Typography.js';
import {QubitMatrix} from '../../../engine/math/matrix/QubitMatrix.js';

const PURE_STATE_THRESHOLD = 0.999;

/**
 * @param {!DisplayView} painter
 * @param {!Rect} drawArea
 * @param {!number} x
 * @param {!number} y
 * @param {!number} z
 * @param {!Array.<!Point>} focusPoints
 */
function _paintBlochSphereDisplay_tooltips(
        painter,
        drawArea,
        x,
        y,
        z,
        focusPoints) {
    let c = drawArea.center();
    let u = Math.min(drawArea.w, drawArea.h) / 2;
    if (focusPoints.every(pt => pt.distanceTo(c) >= u)) {
        return;
    }

    const τ = Math.PI * 2;
    let deg = v => (v >= 0 ? '+' : '') + (v*360/τ).toFixed(2) + '°';
    let forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(4);
    let d = Math.sqrt(x*x + y*y + z*z);
    let ϕ = Math.atan2(y, -x);
    let θ = Math.max(0, Math.PI/2 - Math.atan2(-z, Math.sqrt(y*y + x*x)));
    circle(painter, c, u, {stroke: {color: CanvasTheme.interaction.outline, width: 2}});
    MathPainter.paintDeferredValueTooltip(
        painter,
        c.x+u*Math.sqrt(0.5),
        c.y-u*Math.sqrt(0.5),
        'Bloch sphere representation of local state',
        `r:${forceSign(d)}, ϕ:${deg(ϕ)}, θ:${deg(θ)}`,
        `x:${forceSign(-x)}, y:${forceSign(y)}, z:${forceSign(-z)}`);
}

/**
 * @param {!DisplayView} painter
 * @param {!number} x
 * @param {!number} y
 * @param {!number} z
 * @param {!Rect} drawArea
 * @param {!string=} fillColor
 */
function _paintBlochSphereDisplay_indicator(
        painter,
        x,
        y,
        z,
        drawArea,
        fillColor) {
    let c = drawArea.center();
    let u = Math.min(drawArea.w, drawArea.h) / 2;
    let {dx, dy, dz} = MathPainter.coordinateSystem(u);

    let p = c.plus(dx.times(x)).plus(dy.times(y)).plus(dz.times(z));
    // Scales with the sphere so the indicator stays visible instead of being a fixed few pixels.
    let r = u * 0.12 / (1 + x / 6);

    // Draw state indicators (in not-quite-correct 3d).
    strokePath(painter, [c, p], CanvasTheme.bloch.vector, u * 0.07);
    circle(painter, p, r, {fill: fillColor});

    painter.group('mixed-state-' + painter.order, painter => {
        painter.alpha *= Math.min(1, Math.max(0, 1 - x * x - y * y - z * z));
        circle(painter, p, r, {
            fill: CanvasTheme.bloch.mixed
        });
    });

    circle(painter, p, r, {stroke: {color: CanvasTheme.text.primary, width: 1}});

    // Show depth by lerping the line from overlaying to being overlayd by the ball.
    painter.group('depth-' + painter.order, painter => {
        painter.alpha *= Math.min(1, Math.max(0, 0.5 + x * 5));
        strokePath(painter, [c, p], CanvasTheme.text.primary, 2);
    });
}

/**
 * @param {!DisplayView} painter
 * @param {!Rect} drawArea
 * @param {!number} r The length of the reduced Bloch vector.
 */
function _paintBlochSphereDisplay_purity(painter, drawArea, r) {
    let x = drawArea.center().x;
    let y = drawArea.bottom();
    let readoutHeight = drawArea.w * Layout.BLOCH_READOUT_HEIGHT /
        (2 * (Layout.BLOCH_RADIUS + Layout.BLOCH_LABEL_MARGIN));
    let fontSize = readoutHeight * 2 / 3;
    fitText(painter, `|r| ${r.toFixed(3)}`, {
        x,
        y,
        align: 'center',
        baseline: 'bottom',
        fill: r > PURE_STATE_THRESHOLD ? CanvasTheme.bloch.vector : CanvasTheme.bloch.mixed,
        font: {fontSize: fontSize, fontFamily: Typography.MONO_FONT_FAMILY},
        width: drawArea.w,
        height: readoutHeight,
        beforeDraw: (w, h) => {
            painter.group('purity-plate-' + painter.order, painter => {
                painter.alpha *= 0.7;
                rectangle(painter, new Rect(x - w / 2 - 1, y - h, w + 2, h), {
                    fill: CanvasTheme.surface.background
                });
            });
        }
    });
}

/**
 * @param {!DisplayView} painter
 * @param {!Matrix} qubitDensityMatrix
 * @param {!Rect} drawArea
 * @param {!Array.<!Point>=} focusPoints
 * @param {!string=} backgroundColor
 * @param {!string=} fillColor
 */
function paintBlochSphereDisplay(
        painter,
        qubitDensityMatrix,
        drawArea,
        focusPoints = [],
        backgroundColor = CanvasTheme.bloch.background,
        fillColor = CanvasTheme.bloch.vector) {
    let u = Math.min(
        drawArea.w * Layout.BLOCH_RADIUS / (2 * (Layout.BLOCH_RADIUS + Layout.BLOCH_LABEL_MARGIN)),
        drawArea.h * Layout.BLOCH_RADIUS /
            (2 * (Layout.BLOCH_RADIUS + Layout.BLOCH_LABEL_MARGIN) + Layout.BLOCH_READOUT_HEIGHT));
    let margin = u * Layout.BLOCH_LABEL_MARGIN / Layout.BLOCH_RADIUS;
    let c = new Point(drawArea.center().x, drawArea.y + margin + u);
    let sphereArea = new Rect(c.x - u, c.y - u, 2 * u, 2 * u);
    let {dx, dy, dz} = MathPainter.coordinateSystem(u);

    let hasNaN = qubitDensityMatrix.hasNaN();
    let [x, y, z] = hasNaN ? [NaN, NaN, NaN] : QubitMatrix.densityMatrixToBlochVector(qubitDensityMatrix);
    let r = hasNaN ? NaN : Math.min(1, Math.sqrt(x*x + y*y + z*z));

    // Draw sphere and axis lines (in not-quite-proper 3d).
    circle(painter, c, u, {fill: backgroundColor});

    painter.group('sphere-guides-' + painter.order, painter => {
        // The reference sphere stays equally visible for pure and mixed states.
        circle(painter, c, u, {
            stroke: {
                color: CanvasTheme.stroke.guide,
                width: u * 0.035
            }
        });
        // Split the meridians by depth: internal positive x points away from the viewer.
        for (let axis of [dy, dz]) {
            for (let back of [true, false]) {
                const points = [];
                for (let i = 0; i <= 32; i++) {
                    let t = (back ? 0 : Math.PI) + i * Math.PI / 32;
                    let p = c.plus(dx.times(Math.sin(t))).plus(axis.times(Math.cos(t)));
                    points.push(p);
                }
                strokePath(painter, points, back ? CanvasTheme.stroke.guide : CanvasTheme.stroke.bright, u * 0.035, back ? [u * 0.1, u * 0.1] : []);
            }
        }
        for (let d of [dy, dz]) {
            strokePath(painter, [c.minus(d), c.plus(d)], CanvasTheme.stroke.guide, u * 0.03);
        }
        strokePath(painter, [c, c.minus(dx)], CanvasTheme.stroke.bright, u * 0.035);
        strokePath(painter, [c, c.plus(dx)], CanvasTheme.stroke.guide, u * 0.03, [u * 0.1, u * 0.1]);
    });

    // Labels use conventional Bloch signs: +X is -dx and +Z points up.
    for (let [label, p] of [
        ['X', c.minus(dx.times(2.4))],
        ['Y', c.plus(dy.times(1.12))],
        ['Z', c.minus(dz.times(1.12))]
    ]) {
        fitText(painter, label, {
            x: p.x,
            y: p.y,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.text.primary,
            font: {fontSize: u * 0.36, fontFamily: Typography.MONO_FONT_FAMILY},
            width: u * 0.45,
            height: u * 0.6
        });
    }

    if (hasNaN) {
        fitParagraph(painter, "NaN", drawArea, {
            alignment: new Point(0.5, 0.5),
            fill: CanvasTheme.error.text
        });
    } else {
        _paintBlochSphereDisplay_indicator(painter, x, y, z, sphereArea, fillColor);
        _paintBlochSphereDisplay_purity(painter, drawArea, r);
    }

    _paintBlochSphereDisplay_tooltips(painter, sphereArea, x, y, z, focusPoints);
}

export {paintBlochSphereDisplay};
