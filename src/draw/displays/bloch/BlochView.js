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
import {AXIS_COLOR} from './BlochGeometry.js';
import {DEFAULT_VIEW, glanceBoxFor, paintBlochScene, projectPoint} from './BlochScene.js';
import {fitText} from '../../text/TextLayout.js';
import {circle, rectangle} from '../../shapes/ShapeView.js';

/** @typedef {import('../../scene/DisplayView.js').DisplayView} DisplayView */

import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Layout} from '../../../config/Layout.js';
import {Point} from '../../../geometry/Point.js';
import {Rect} from '../../../geometry/Rect.js';
import {Typography} from '../../../config/Typography.js';
import {blochCoordinates, blochReading, degreesText, PURE_STATE_THRESHOLD} from '../../../engine/math/bloch.js';

/**
 * The hover ring and tooltip: the same reading the analyzer gives, with the same rules - an angle
 * that does not exist reads "—" (RULE A, B) - in the conventional coordinates the analyzer uses.
 * @param {!DisplayView} painter
 * @param {!Point} c The sphere's centre.
 * @param {!number} u The sphere's radius.
 * @param {!{x: !number, y: !number, z: !number}} vec
 * @param {!import('../../../engine/math/bloch.js').BlochReading} reading
 * @param {!Array.<!Point>} focusPoints
 */
function _paintBlochSphereDisplay_tooltips(painter, c, u, vec, reading, focusPoints) {
    if (focusPoints.every(pt => pt.distanceTo(c) >= u)) {
        return;
    }
    const {r, theta, phi} = reading;
    const forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(4);
    circle(painter, c, u, {stroke: {color: CanvasTheme.interaction.outline, width: 2}});
    TooltipLayer.forView(painter).show(painter, {
        x: c.x+u*Math.sqrt(0.5),
        y: c.y-u*Math.sqrt(0.5),
        labelText: 'Bloch sphere · click to enlarge',
        valueText: `r:${forceSign(r)}, θ:${degreesText(theta)}, ϕ:${degreesText(phi)}`,
        valueText2: `x:${forceSign(vec.x)}, y:${forceSign(vec.y)}, z:${forceSign(vec.z)}`
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
 * A qubit's local state as a small sphere in the circuit.
 *
 * The sphere itself is paintBlochScene at glance size, the painter the analyzer uses, from the same
 * default view: the circuit's sphere and the analyzer it opens cannot disagree about which way an
 * axis points. Around it this adds what a circuit glyph needs: the axis letters, the |r| readout
 * underneath and the hover tooltip.
 *
 * @param {!DisplayView} painter
 * @param {!Matrix} qubitDensityMatrix
 * @param {!Rect} drawArea
 * @param {!Array.<!Point>=} focusPoints
 */
function paintBlochSphereDisplay(
        painter,
        qubitDensityMatrix,
        drawArea,
        focusPoints = []) {
    const u = Math.min(
        drawArea.w * Layout.BLOCH_RADIUS / (2 * (Layout.BLOCH_RADIUS + Layout.BLOCH_LABEL_MARGIN)),
        drawArea.h * Layout.BLOCH_RADIUS /
            (2 * (Layout.BLOCH_RADIUS + Layout.BLOCH_LABEL_MARGIN) + Layout.BLOCH_READOUT_HEIGHT));
    const margin = u * Layout.BLOCH_LABEL_MARGIN / Layout.BLOCH_RADIUS;
    const c = new Point(drawArea.center().x, drawArea.y + margin + u);

    const hasNaN = qubitDensityMatrix.hasNaN();
    const vec = hasNaN ? undefined : blochCoordinates(qubitDensityMatrix);
    const reading = hasNaN ? undefined : blochReading(vec);
    const r = hasNaN ? NaN : Math.min(1, reading.r);

    // The shared painter, sized so its sphere has radius u about c, drawn in this painter's own
    // coordinates and unfilled, so a hovered gate's tint shows around the sphere.
    const size = glanceBoxFor(u);
    paintBlochScene(painter, size, vec, DEFAULT_VIEW.yaw, DEFAULT_VIEW.pitch,
        {origin: {x: c.x - size / 2, y: c.y - size / 2}, transparent: true, reading});

    // Each positive axis named in its colour, where the analyzer puts the same axis's ket.
    for (const [label, dir, color] of [['X', [1, 0, 0], AXIS_COLOR.x], ['Y', [0, 1, 0], AXIS_COLOR.y],
            ['Z', [0, 0, 1], AXIS_COLOR.z]]) {
        const p = projectPoint(...dir.map(v => v * 1.22), DEFAULT_VIEW.yaw, DEFAULT_VIEW.pitch);
        fitText(painter, label, {
            x: c.x + p.sx * u,
            y: c.y - p.sy * u,
            align: 'center',
            baseline: 'middle',
            fill: color,
            font: {fontSize: u * 0.36, fontFamily: Typography.MONO_FONT_FAMILY},
            width: u * 0.45,
            height: u * 0.6
        });
    }

    if (!hasNaN) {
        _paintBlochSphereDisplay_purity(painter, drawArea, r);
        _paintBlochSphereDisplay_tooltips(painter, c, u, vec, reading, focusPoints);
    }
}

export {paintBlochSphereDisplay};
