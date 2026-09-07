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

import {rectangle, strokePath} from '../pixi/ShapeView.js';
import {fitText} from '../pixi/TextLayout.js';

import {Layout} from '../../config/Layout.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {MathPainter} from '../MathPainter.js';
import {Point} from '../../geometry/Point.js';
import {Util} from '../../base/Util.js';

import {paintBackground, paintOutline, paintResizeTab, paintLocationIndependentFrame} from './GateFrame.js';
import {GATE_SYMBOL_FONT, paintGateSymbol} from './GateSymbol.js';

/** @typedef {import('./GateDrawParams.js').GateDrawParams} GateDrawParams */

/**
 * @param {!string=} fillColor
 * @returns {!function(!GateDrawParams)}
 */
const MAKE_HIGHLIGHTED_DRAWER = (fillColor = undefined) => args => {
    paintBackground(args, fillColor);
    paintOutline(args);
    paintResizeTab(args);
    paintGateSymbol(args);
};

/**
 * @param {!GateDrawParams} args
 */
const DEFAULT_DRAWER = MAKE_HIGHLIGHTED_DRAWER();

/**
 * @param {!GateDrawParams} args
 */
const LABEL_DRAWER = args => {
    if (args.positionInCircuit === undefined || args.isHighlighted) {
        DEFAULT_DRAWER(args);
        return;
    }

    let cut = Math.max(0, args.rect.h - Layout.GATE_RADIUS*2)/2;
    rectangle(args.painter, args.rect.skipTop(cut).skipBottom(cut), {fill: CanvasTheme.surface.gate});

    paintGateSymbol(args);
};

/**
 * @param {!string} normalFillColor
 * @returns {!function(!GateDrawParams)}
 */
const makeLocationIndependentGateDrawer = normalFillColor => args => {
    paintLocationIndependentFrame(args, normalFillColor);
    paintGateSymbol(args);
};

/**
 * @param {!GateDrawParams} args
 */
const LOCATION_INDEPENDENT_GATE_DRAWER = makeLocationIndependentGateDrawer(CanvasTheme.surface.gate);

/**
 * @param {!Array.<!string>} labels
 * @param {!Array.<!number>} dividers
 * @returns {!function(!GateDrawParams)}
 */
const SECTIONED_DRAWER_MAKER = (labels, dividers) => args => {
    let backColor = args.isHighlighted ? CanvasTheme.gate.hover : CanvasTheme.surface.gate;
    rectangle(args.painter, args.rect, {fill: backColor});
    let p = 0;
    for (let i = 0; i < labels.length; i++) {
        let p2;
        if (i < labels.length - 1) {
            p2 = p + dividers[i];
            let cy = args.rect.y + args.rect.h*p2;
            strokePath(args.painter, [new Point(args.rect.x, cy), new Point(args.rect.right(), cy)],
                CanvasTheme.stroke.faint, 1);
        } else {
            p2 = 1;
        }
        fitText(args.painter, labels[i], {
            x: args.rect.x + args.rect.w/2,
            y: args.rect.y + args.rect.h*(p + p2)/2,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.text.primary,
            font: GATE_SYMBOL_FONT,
            width: args.rect.w - 2,
            height: args.rect.h*(p2 - p)
        });
        p = p2;
    }
    rectangle(args.painter, args.rect, {stroke: {color: CanvasTheme.text.primary, width: 1}});
    paintResizeTab(args);
};

const DISPLAY_GATE_DEFAULT_DRAWER = MAKE_HIGHLIGHTED_DRAWER();

/**
 * @param {!function(!GateDrawParams)} statePainter
 * @returns {!function(!GateDrawParams)}
 */
const makeDisplayDrawer = statePainter => args => {
    if (args.positionInCircuit === undefined) {
        DISPLAY_GATE_DEFAULT_DRAWER(args);
        return;
    }

    statePainter(args);

    if (args.isHighlighted) {
        rectangle(args.painter, args.rect, {stroke: {color: CanvasTheme.text.primary, width: 1.5}});
    }

    // Draw the tab once, above the display, with its normal/highlight opacity.
    paintResizeTab(args);
};

/**
 * @param {!GateDrawParams} args
 */
const MATRIX_DRAWER = args => {
    let m = args.gate.knownMatrixAt(args.stats.time);
    if (m === undefined) {
        DEFAULT_DRAWER(args);
        return;
    }

    rectangle(args.painter, args.rect, {fill: args.isHighlighted ? CanvasTheme.gate.hover : CanvasTheme.surface.gate});
    MathPainter.paintMatrix(
        args.painter,
        m,
        args.rect,
        CanvasTheme.operation.fill,
        CanvasTheme.text.primary,
        undefined,
        CanvasTheme.operation.background,
        undefined,
        CanvasTheme.transparent);
    if (args.isHighlighted) {
        args.painter.group('hover-' + args.painter.order, painter => {
            painter.alpha *= 0.9;
            rectangle(painter, args.rect, {fill: CanvasTheme.gate.hover});
        });
    }
    paintOutline(args);
};

/**
 * @param {!GateDrawParams} args
 * @param {!number} angle
 * @param {!number=} xScale
 * @param {!number=} yScale
 * @param {!number=} zeroAngle
 */
function paintCycleState(args, angle, xScale = 1, yScale = 1, zeroAngle = 0) {
    let t = Util.properMod(-angle, 2 * Math.PI);
    let c = args.rect.center();
    let r = 16;

    args.painter.group('cycle-' + args.painter.order, painter => {
        painter.position.set(c.x, c.y);
        painter.scale.set(-xScale, -yScale);
        painter.alpha = 0.4;
        painter.group('angle', painter => {
            painter.rotation = zeroAngle;
            const path = painter.graphics();
            path.moveTo(0, 0);
            path.lineTo(0, r);
            path.arc(0, 0, r, Math.PI / 2, Math.PI / 2 + t, true);
            path.lineTo(0, 0);
            path.closePath();
            path.stroke({color: CanvasTheme.text.primary, width: 1}).fill(CanvasTheme.operation.fill);
        });
    });
}

/**
 * @param {!number=} xScale
 * @param {!number=} yScale
 * @param {!number=} tScale
 * @param {!number=} zeroAngle
 * @returns {!function(!GateDrawParams)}
 */
const makeCycleDrawer = (xScale = 1, yScale = 1, tScale = 1, zeroAngle = 0) => args => {
    // The clock marks time dependence while the fill retains the operation family.
    DEFAULT_DRAWER(args);
    paintCycleState(args, args.stats.time * 2 * Math.PI * tScale, xScale, yScale, zeroAngle);
};

export {
    MAKE_HIGHLIGHTED_DRAWER,
    DEFAULT_DRAWER,
    LABEL_DRAWER,
    makeLocationIndependentGateDrawer,
    LOCATION_INDEPENDENT_GATE_DRAWER,
    SECTIONED_DRAWER_MAKER,
    makeDisplayDrawer,
    MATRIX_DRAWER,
    paintCycleState,
    makeCycleDrawer
}
