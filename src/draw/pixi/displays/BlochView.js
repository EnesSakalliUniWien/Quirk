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
 * Below this sphere radius the dashed back guides go: at a gate's size seven lines in sixty pixels
 * hid the vector, and the front meridians and axes still say which way is which.
 */
const DETAILED_SPHERE_RADIUS = 40;

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
    const c = drawArea.center();
    const u = Math.min(drawArea.w, drawArea.h) / 2;
    if (focusPoints.every(pt => pt.distanceTo(c) >= u)) {
        return;
    }

    const τ = Math.PI * 2;
    const deg = v => (v >= 0 ? '+' : '') + (v*360/τ).toFixed(2) + '°';
    const forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(4);
    const d = Math.sqrt(x*x + y*y + z*z);
    const ϕ = Math.atan2(y, -x);
    const θ = Math.max(0, Math.PI/2 - Math.atan2(-z, Math.sqrt(y*y + x*x)));
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
    const c = drawArea.center();
    const u = Math.min(drawArea.w, drawArea.h) / 2;
    const {dx, dy, dz} = MathPainter.coordinateSystem(u);

    const p = c.plus(dx.times(x)).plus(dy.times(y)).plus(dz.times(z));
    // Scales with the sphere so the indicator stays visible instead of being a fixed few pixels.
    const r = u * 0.16 / (1 + x / 6);

    // Draw state indicators (in not-quite-correct 3d).
    strokePath(painter, [c, p], CanvasTheme.bloch.vector, u * 0.1);
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
    const x = drawArea.center().x;
    const y = drawArea.bottom();
    const readoutHeight = drawArea.w * Layout.BLOCH_READOUT_HEIGHT /
        (2 * (Layout.BLOCH_RADIUS + Layout.BLOCH_LABEL_MARGIN));
    const fontSize = readoutHeight * 0.75;
    // A mixed state greys out, as its ball does; a pure one reads in the primary ink.
    fitText(painter, `|r| ${r.toFixed(3)}`, {
        x,
        y,
        align: 'center',
        baseline: 'bottom',
        fill: r > PURE_STATE_THRESHOLD ? CanvasTheme.text.primary : CanvasTheme.bloch.mixed,
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
    const u = Math.min(
        drawArea.w * Layout.BLOCH_RADIUS / (2 * (Layout.BLOCH_RADIUS + Layout.BLOCH_LABEL_MARGIN)),
        drawArea.h * Layout.BLOCH_RADIUS /
            (2 * (Layout.BLOCH_RADIUS + Layout.BLOCH_LABEL_MARGIN) + Layout.BLOCH_READOUT_HEIGHT));
    const margin = u * Layout.BLOCH_LABEL_MARGIN / Layout.BLOCH_RADIUS;
    const c = new Point(drawArea.center().x, drawArea.y + margin + u);
    const sphereArea = new Rect(c.x - u, c.y - u, 2 * u, 2 * u);
    const {dx, dy, dz} = MathPainter.coordinateSystem(u);

    const hasNaN = qubitDensityMatrix.hasNaN();
    const [x, y, z] = hasNaN ? [NaN, NaN, NaN] : QubitMatrix.densityMatrixToBlochVector(qubitDensityMatrix);
    const r = hasNaN ? NaN : Math.min(1, Math.sqrt(x*x + y*y + z*z));

    // Draw sphere and axis lines (in not-quite-proper 3d).
    circle(painter, c, u, {fill: backgroundColor});

    const detailed = u >= DETAILED_SPHERE_RADIUS;
    painter.group('sphere-guides-' + painter.order, painter => {
        // The reference sphere stays equally visible for pure and mixed states.
        circle(painter, c, u, {
            stroke: {
                color: CanvasTheme.stroke.guide,
                width: u * 0.035
            }
        });
        // Split the meridians by depth: internal positive x points away from the viewer.
        for (const axis of [dy, dz]) {
            for (const back of detailed ? [true, false] : [false]) {
                const points = [];
                for (let i = 0; i <= 32; i++) {
                    const t = (back ? 0 : Math.PI) + i * Math.PI / 32;
                    const p = c.plus(dx.times(Math.sin(t))).plus(axis.times(Math.cos(t)));
                    points.push(p);
                }
                strokePath(painter, points, back ? CanvasTheme.stroke.guide : CanvasTheme.stroke.bright, u * 0.035, back ? [u * 0.1, u * 0.1] : []);
            }
        }
        for (const d of [dy, dz]) {
            strokePath(painter, [c.minus(d), c.plus(d)], CanvasTheme.stroke.guide, u * 0.03);
        }
        strokePath(painter, [c, c.minus(dx)], CanvasTheme.stroke.bright, u * 0.035);
        if (detailed) {
            strokePath(painter, [c, c.plus(dx)], CanvasTheme.stroke.guide, u * 0.03, [u * 0.1, u * 0.1]);
        }
    });

    // Labels use conventional Bloch signs: +X is -dx and +Z points up.
    for (const [label, p] of [
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
