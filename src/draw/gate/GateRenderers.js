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

import {frame, highlightRing, lineWidth, rectangle, strokePath} from '../pixi/ShapeView.js';
import {fitText} from '../pixi/TextLayout.js';

import {Layout} from '../../config/Layout.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {DATA_RENDERERS} from '../renderers/dataRenderers.js';
import {Point} from '../../geometry/Point.js';
import {Util} from '../../base/Util.js';

import {paintBackground, paintOutline, paintResizeTab, paintLocationIndependentFrame} from './GateFrame.js';
import {GATE_SYMBOL_FONT, paintGateSymbol} from './GateSymbol.js';

/** @typedef {import('./GateRenderParams.js').GateRenderParams} GateRenderParams */

/**
 * @param {!string=} fillColor
 * @returns {!function(!GateRenderParams)}
 */
const MAKE_HIGHLIGHTED_RENDERER = (fillColor = undefined) => args => {
    paintBackground(args, fillColor);
    paintOutline(args);
    paintResizeTab(args);
    paintGateSymbol(args);
};

/**
 * @param {!GateRenderParams} args
 */
const DEFAULT_RENDERER = MAKE_HIGHLIGHTED_RENDERER();

/**
 * @param {!GateRenderParams} args
 */
const LABEL_RENDERER = args => {
    if (args.positionInCircuit === undefined || args.isHighlighted) {
        DEFAULT_RENDERER(args);
        return;
    }

    const cut = Math.max(0, args.rect.h - Layout.GATE_RADIUS*2)/2;
    rectangle(args.painter, args.rect.skipTop(cut).skipBottom(cut), {fill: CanvasTheme.surface.gate});

    paintGateSymbol(args);
};

/**
 * @param {!string} normalFillColor
 * @returns {!function(!GateRenderParams)}
 */
const makeLocationIndependentGateRenderer = normalFillColor => args => {
    paintLocationIndependentFrame(args, normalFillColor);
    paintGateSymbol(args);
};

/**
 * @param {!GateRenderParams} args
 */
const LOCATION_INDEPENDENT_GATE_RENDERER = makeLocationIndependentGateRenderer(CanvasTheme.surface.gate);

/**
 * @param {!Array.<!string>} labels
 * @param {!Array.<!number>} dividers
 * @returns {!function(!GateRenderParams)}
 */
const SECTIONED_RENDERER_MAKER = (labels, dividers) => args => {
    const backColor = args.isHighlighted ? CanvasTheme.gate.hover : CanvasTheme.surface.gate;
    rectangle(args.painter, args.rect, {fill: backColor});
    let p = 0;
    for (let i = 0; i < labels.length; i++) {
        let p2;
        if (i < labels.length - 1) {
            p2 = p + dividers[i];
            const cy = args.rect.y + args.rect.h*p2;
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
    rectangle(args.painter, args.rect, {stroke: {color: CanvasTheme.text.primary, width: lineWidth(args.painter, 1)}});
    if (args.isHighlighted) {
        highlightRing(args.painter, args.rect);
    }
    paintResizeTab(args);
};

const DISPLAY_GATE_DEFAULT_RENDERER = MAKE_HIGHLIGHTED_RENDERER();

/**
 * @param {!function(!GateRenderParams)} statePainter
 * @returns {!function(!GateRenderParams)}
 */
const makeDisplayRenderer = statePainter => args => {
    if (args.positionInCircuit === undefined) {
        DISPLAY_GATE_DEFAULT_RENDERER(args);
        return;
    }

    statePainter(args);

    // Every display wears the frame ink, not only while hovered: its dark fill is barely lighter
    // than the canvas, so the frame is its edge.
    frame(args.painter, args.rect);
    if (args.isHighlighted) {
        highlightRing(args.painter, args.rect);
    }

    // Draw the tab once, above the display, with its normal/highlight opacity.
    paintResizeTab(args);
};

/**
 * @param {!GateRenderParams} args
 */
const MATRIX_RENDERER = args => {
    const m = args.gate.knownMatrixAt(args.stats.time);
    if (m === undefined) {
        DEFAULT_RENDERER(args);
        return;
    }

    rectangle(args.painter, args.rect, {fill: args.isHighlighted ? CanvasTheme.gate.hover : CanvasTheme.surface.gate});
    DATA_RENDERERS.matrix(args.painter, m, args.rect);
    if (args.isHighlighted) {
        args.painter.group('hover-' + args.painter.order, painter => {
            painter.alpha *= 0.9;
            rectangle(painter, args.rect, {fill: CanvasTheme.gate.hover});
        });
    }
    paintOutline(args);
};

/**
 * @param {!GateRenderParams} args
 * @param {!number} angle
 * @param {!number=} xScale
 * @param {!number=} yScale
 * @param {!number=} zeroAngle
 */
function paintCycleState(args, angle, xScale = 1, yScale = 1, zeroAngle = 0) {
    const t = Util.properMod(-angle, 2 * Math.PI);
    const c = args.rect.center();
    const r = 16;

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
 * @returns {!function(!GateRenderParams)}
 */
const makeCycleRenderer = (xScale = 1, yScale = 1, tScale = 1, zeroAngle = 0) => args => {
    // The clock marks time dependence while the fill retains the operation family.
    DEFAULT_RENDERER(args);
    paintCycleState(args, args.stats.time * 2 * Math.PI * tScale, xScale, yScale, zeroAngle);
};

export {
    MAKE_HIGHLIGHTED_RENDERER,
    DEFAULT_RENDERER,
    LABEL_RENDERER,
    makeLocationIndependentGateRenderer,
    LOCATION_INDEPENDENT_GATE_RENDERER,
    SECTIONED_RENDERER_MAKER,
    makeDisplayRenderer,
    MATRIX_RENDERER,
    paintCycleState,
    makeCycleRenderer
}
