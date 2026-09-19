import {Appearance} from '../../appearance/Appearance.js';
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

import {frame, highlightRing, lineWidth, rectangle, strokePath} from '../shapes/ShapeView.js';
import {fitText} from '../text/TextLayout.js';

import {Layout} from '../../config/Layout.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {DATA_RENDERERS} from '../renderers/dataRenderers.js';
import {Point} from '../../geometry/Point.js';
import {Rect} from '../../geometry/Rect.js';

import {paintBackground, paintOutline, paintResizeTab, paintLocationIndependentFrame} from './GateFrame.js';
import {GATE_SYMBOL_FONT, paintGateSymbol} from './GateSymbol.js';
import {paintTimeDial} from './TimeDial.js';

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
    rectangle(args.painter, args.rect, {stroke: {color: CanvasTheme.text.primary, width: lineWidth(args.painter, Appearance.borders.width.regular)}});
    if (args.isHighlighted) {
        highlightRing(args.painter, args.rect);
    }
    paintResizeTab(args);
};

const DISPLAY_GATE_DEFAULT_RENDERER = MAKE_HIGHLIGHTED_RENDERER();

/**
 * @param {!function(!GateRenderParams): (undefined|!Rect)} statePainter Returns what it occupied,
 *     when that is less than the gate.
 * @param {!{framed: (undefined|!boolean)}=} options framed is false for a display that is its own
 *     shape, like the Bloch sphere, which wears no box around it.
 * @returns {!function(!GateRenderParams)}
 */
const makeDisplayRenderer = (statePainter, {framed = true} = {}) => args => {
    if (args.positionInCircuit === undefined) {
        DISPLAY_GATE_DEFAULT_RENDERER(args);
        return;
    }

    const drawn = statePainter(args);
    const content = drawn instanceof Rect ? drawn : args.rect;

    // A distinct outer edge separates dark display surfaces from the canvas. It follows what was
    // drawn, so space the display leaves empty inside its gate does not read as part of it.
    if (framed) {
        frame(args.painter, content, CanvasTheme.stroke.displayFrame);
    }
    if (args.isHighlighted) {
        highlightRing(args.painter, content);
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
 * A gate drawn with the dial beside it, reading the gate's own turnsAt - the very number its effect
 * is built from, so the dial cannot show one thing while the simulation does another.
 *
 * @param {!{xScale: (undefined|!number), yScale: (undefined|!number), zeroAngle: (undefined|!number)}} axis
 *     The dial's face; see DIAL_AXIS.
 * @returns {!function(!GateRenderParams)}
 */
const makeCycleRenderer = axis => args => {
    // The dial marks time dependence while the fill retains the operation family.
    DEFAULT_RENDERER(args);
    paintTimeDial(args, args.gate.turnsAt(args.stats.time, args.gate.param), axis);
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
    makeCycleRenderer
}
