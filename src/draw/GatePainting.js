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
import {drawPath, rectangle, strokePath} from './pixi/ShapeView.js';
import {fitText, measureText} from './pixi/TextLayout.js';

/** @typedef {import('./pixi/DisplayView.js').DisplayView} DisplayView */

import {Layout} from '../config/Layout.js';
import {gateButtonRect} from '../editor/CircuitGeometry.js';
import {CanvasTheme, gateStyle} from '../config/CanvasTheme.js';
import {Typography} from '../config/Typography.js';

import {MathPainter} from './MathPainter.js';
import {Point} from '../math/Point.js';
import {Rect} from '../math/Rect.js';
import {Util} from '../base/Util.js';

/**
 * A described and possibly time-varying quantum operation.
 */
class GatePainting {}

/**
 * @param {!number} size
 * @returns {!string}
 */
function gateSymbolFont(size) {
    return {fontWeight: Typography.GATE_SYMBOL_FONT_WEIGHT, fontSize: size, fontFamily: Typography.DEFAULT_FONT_FAMILY};
}

const GATE_SYMBOL_FONT = gateSymbolFont(Typography.GATE_SYMBOL_FONT_SIZE);

/**
 * The sizes a gate symbol is allowed to take. fitText shrinks text to whatever fits, with no
 * floor, which let a long symbol like Rz(f(t)) render at a few pixels beside a Z at sixteen. The
 * symbol steps down this ramp instead, and wraps once it reaches the bottom.
 * @type {!Array.<!number>}
 */
const GATE_SYMBOL_FONT_SIZES = [Typography.GATE_SYMBOL_FONT_SIZE, 13, Typography.GATE_SYMBOL_MIN_FONT_SIZE];

/**
 * Splits a symbol across two lines at the break nearest its middle, so neither line is a stub.
 * @param {!string} text
 * @returns {!Array.<!string>}
 */
function splitGateSymbol(text) {
    // A name and its argument, which is the seam in Rx(f(t)) and its kin.
    let best = text.indexOf('(');
    if (best < 1) {
        // Otherwise the break nearest the middle, so neither line is a stub.
        let middle = text.length / 2;
        best = -1;
        for (let i = 1; i < text.length; i++) {
            let isBreak = text[i - 1] === '/' || text[i - 1] === ' ';
            if (isBreak && (best === -1 || Math.abs(i - middle) < Math.abs(best - middle))) {
                best = i;
            }
        }
    }
    return best === -1 ? [text] : [text.slice(0, best).trim(), text.slice(best).trim()];
}

/**
 * The largest step of the ramp the text fits on, and the lines to draw it as.
 * @param {!DisplayView} painter
 * @param {!string} text
 * @param {!number} maxWidth
 * @returns {!{font: !Object, lines: !Array.<!string>}}
 */
function fitGateSymbol(painter, text, maxWidth) {
    for (let size of GATE_SYMBOL_FONT_SIZES) {
        const font = gateSymbolFont(size);
        if (measureText(text, font).width <= maxWidth) {
            return {font: gateSymbolFont(size), lines: [text]};
        }
    }
    return {
        font: gateSymbolFont(Typography.GATE_SYMBOL_MIN_FONT_SIZE),
        lines: splitGateSymbol(text)
    };
}

GatePainting.paintOutline = args => {
    rectangle(args.painter, args.rect, {stroke: {color: args.isHighlighted ? CanvasTheme.interaction.outline : CanvasTheme.text.primary, width: 1}});
};

GatePainting.paintBackground =
    (args, fillColor = gateStyle(args.gate).fill) => {
        rectangle(args.painter, args.rect, {fill: fillColor});
    };

/**
 * @param {!GateDrawParams} args
 */
GatePainting.LABEL_DRAWER = args => {
    if (args.positionInCircuit === undefined || args.isHighlighted) {
        GatePainting.DEFAULT_DRAWER(args);
        return;
    }

    let cut = Math.max(0, args.rect.h - Layout.GATE_RADIUS*2)/2;
    rectangle(args.painter, args.rect.skipTop(cut).skipBottom(cut), {fill: CanvasTheme.surface.gate});

    GatePainting.paintGateSymbol(args);
};

/**
 * @param {!string=} fillColor
 * @constructor
 */
GatePainting.MAKE_HIGHLIGHTED_DRAWER =
    (fillColor = undefined) => args => {
        GatePainting.paintBackground(args, fillColor);
        GatePainting.paintOutline(args);
        GatePainting.paintResizeTab(args);
        GatePainting.paintGateSymbol(args);
    };

/**
 * @param {!GateDrawParams} args
 */
GatePainting.DEFAULT_DRAWER = GatePainting.MAKE_HIGHLIGHTED_DRAWER();

/**
 * @param {!Rect} gateRect
 * @returns {!Rect}
 */
GatePainting.rectForResizeTab = gateRect => {
    let overlap = Math.min(Layout.GATE_RADIUS, gateRect.h/4);
    return new Rect(gateRect.x, gateRect.bottom() - overlap, gateRect.w, Layout.GATE_RADIUS * 2);
};

/**
 * @param {!GateDrawParams} args
 */
GatePainting.paintResizeTab = args => {
    if (!args.isResizeShowing || !args.gate.canChangeInSize()) {
        return;
    }

    let d = Layout.GATE_RADIUS;
    let rect = GatePainting.rectForResizeTab(args.rect);
    let trimRect = rect.skipLeft(2).skipRight(2);
    let {x: cx, y: cy} = trimRect.center();
    let backColor = args.isResizeHighlighted ? CanvasTheme.gate.hover : CanvasTheme.surface.gate;
    let foreColor = args.isResizeHighlighted ? CanvasTheme.text.default : CanvasTheme.text.muted;
    args.painter.group('resize-tab-' + args.painter.order, painter => {
        painter.alpha *= args.isResizeHighlighted ? 1 : 0.7;
        rectangle(painter, trimRect, {
            fill: backColor
        });
        rectangle(painter, trimRect, {
            stroke: {
                color: CanvasTheme.stroke.guide,
                width: 1
            }
        });
    });
    fitText(args.painter, 'resize', {
        x: cx,
        y: cy,
        align: 'center',
        baseline: 'middle',
        fill: foreColor,
        font: {fontSize: 16, fontFamily: Typography.MONO_FONT_FAMILY},
        width: trimRect.w - 4,
        height: trimRect.h - 4
    });
    drawPath(args.painter, tracer => {
        let arrowDirs = [
            args.gate.canIncreaseInSize() ? +1 : -1,
            args.gate.canDecreaseInSize() ? -1 : +1
        ];
        let arrowOffsets = [+1, -1];
        for (let sx of [-1, +1]) {
            for (let k = 0; k < 2; k++) {
                let by = cy + d*arrowOffsets[k]*5/8;
                let y1 = by + d*arrowDirs[k]/8;
                let y2 = by - d*arrowDirs[k]/8;
                PathGeometry.line(tracer, cx, y1, cx + d*sx*0.3, y2);
            }
        }
    }, [{stroke: {color: foreColor, width: 1}}]);
};

/**
 * @param {!GateDrawParams} args
 * @param {undefined|!string=undefined} symbolOverride
 * @param {!boolean=} allowExponent
 */
GatePainting.paintGateSymbol = (args, symbolOverride=undefined, allowExponent=true) => {
    let painter = args.painter;
    const ink = gateStyle(args.gate).text;
    let rect = args.rect.paddedBy(-2);
    if (symbolOverride === undefined) {
        symbolOverride = args.gate.symbol;
    }
    let {symbol, offsetY} = _paintSymbolHandleLines(args.painter, symbolOverride, rect, ink);
    const font = GATE_SYMBOL_FONT;  // So that measure-text calls return the right stuff.

    let splitIndex = allowExponent ? symbol.indexOf('^') : -1;
    let parts = splitIndex === -1 ? [symbol] : [symbol.substr(0, splitIndex), symbol.substr(splitIndex + 1)];
    if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
        let {font, lines: symbolLines} = fitGateSymbol(painter, symbol, rect.w);
        let lineHeight = rect.h / symbolLines.length;
        for (let i = 0; i < symbolLines.length; i++) {
            fitText(painter, symbolLines[i], {
                x: rect.x + rect.w/2,
                y: rect.y + rect.h/2 + offsetY + (i - (symbolLines.length - 1)/2) * lineHeight,
                align: 'center',
                baseline: 'middle',
                fill: ink,
                font,
                width: rect.w,
                height: lineHeight
            });
        }
        return;
    }

    let [baseText, expText] = parts;
    let lines = baseText.split('\n');
    baseText = lines[0];

    // The same ramp as the plain branch, so a symbol with an exponent and one without come out at
    // the same size rather than as two typographic systems side by side.
    let {font: symbolFont} = fitGateSymbol(painter, baseText + expText, rect.w);

    let baseWidth = measureText(baseText, symbolFont).width;
    let expWidth = measureText(expText, symbolFont).width;
    let scaleDown = Math.min(rect.w, baseWidth + expWidth) / (baseWidth + expWidth);
    let divider = rect.w/2 + (baseWidth - expWidth)*scaleDown/2;
    fitText(painter, baseText, {
        x: rect.x + divider,
        y: rect.y + rect.h/2 + offsetY,
        align: 'right',
        baseline: 'hanging',
        fill: ink,
        font: symbolFont,
        width: divider,
        height: rect.h
    });
    fitText(painter, expText, {
        x: rect.x + divider,
        y: rect.y + rect.h/2 + offsetY,
        align: 'left',
        baseline: 'alphabetic',
        fill: ink,
        font: symbolFont,
        width: rect.w - divider,
        height: rect.h
    });
};

/**
 * @param {!DisplayView} painter
 * @param {!string} symbol
 * @param {!Rect} rect
 * @returns {!{symbol: !string, offsetY: !int}} The symbol without any extra lines.
 * @private
 */
function _paintSymbolHandleLines(painter, symbol, rect, ink) {
    let lines = symbol.split('\n');

    for (let i = 1; i < lines.length; i++) {
        fitText(painter, lines[i], {
            x: rect.x + rect.w/2,
            y: rect.y + rect.h/2 + 9*i,
            align: 'center',
            baseline: 'hanging',
            fill: ink,
            font: GATE_SYMBOL_FONT,
            width: rect.w,
            height: 16
        });
    }

    return {symbol: lines[0], offsetY: lines.length > 1 ? -5 : 0};
}

/**
 * @param {!GateDrawParams} args
 * @param {!GraphicsPath} tracer
 */
GatePainting.traceLocationIndependentOutline = (args, tracer) => {
    let [x1, x2, y1, y2] = [args.rect.x, args.rect.right(), args.rect.y, args.rect.bottom()];
    let diameter = Math.min(args.rect.h, args.rect.w, Layout.GATE_RADIUS*2);
    let clip = diameter / (2 + Math.sqrt(2));
    tracer.poly([
        x1, y1 + clip,
        x1 + clip, y1,

        x2 - clip, y1,
        x2, y1 + clip,

        x2, y2 - clip,
        x2 - clip, y2,

        x1 + clip, y2,
        x1, y2 - clip
    ]);
};

/**
 * @param {!GateDrawParams} args
 * @param {!string} normalFillColor
 */
GatePainting.paintLocationIndependentFrame = (args, normalFillColor = CanvasTheme.surface.gate) => {
    let backColor = args.isHighlighted ? CanvasTheme.gate.hover : normalFillColor;
    drawPath(args.painter, tracer => GatePainting.traceLocationIndependentOutline(args, tracer), [{fill: backColor}, {stroke: {color: CanvasTheme.text.primary, width: 1}}]);
};

/**
 * @param {!string} normalFillColor
 * @returns {!function(!GateDrawParams)}
 */
GatePainting.makeLocationIndependentGateDrawer = normalFillColor => args => {
    GatePainting.paintLocationIndependentFrame(args, normalFillColor);
    GatePainting.paintGateSymbol(args);
};

/**
 * @param {!GateDrawParams} args
 */
GatePainting.LOCATION_INDEPENDENT_GATE_DRAWER = GatePainting.makeLocationIndependentGateDrawer(CanvasTheme.surface.gate);

/**
 * @param {!Array.<!string>} labels
 * @param {!Array.<!number>} dividers
 * @returns {!function(!GateDrawParams)}
 */
GatePainting.SECTIONED_DRAWER_MAKER = (labels, dividers) => args => {
    let backColor = args.isHighlighted ? CanvasTheme.gate.hover : CanvasTheme.surface.gate;
    const font = GATE_SYMBOL_FONT;
    rectangle(args.painter, args.rect, {fill: backColor});
    let p = 0;
    for (let i = 0; i < labels.length; i++) {
        let p2;
        if (i < labels.length - 1) {
            p2 = p + dividers[i];
            let cy = args.rect.y + args.rect.h*p2;
            strokePath(args.painter, [new Point(args.rect.x, cy), new Point(args.rect.right(), cy)], CanvasTheme.stroke.faint, 1);
        } else {
            p2 = 1;
        }
        fitText(args.painter, labels[i], {
            x: args.rect.x + args.rect.w/2,
            y: args.rect.y + args.rect.h*(p + p2)/2,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.text.primary,
            font,
            width: args.rect.w-2,
            height: args.rect.h*(p2-p)
        });
        p = p2;
    }
    rectangle(args.painter, args.rect, {stroke: {color: CanvasTheme.text.primary, width: 1}});
    GatePainting.paintResizeTab(args);
};

const DISPLAY_GATE_DEFAULT_DRAWER = GatePainting.MAKE_HIGHLIGHTED_DRAWER();

GatePainting.makeDisplayDrawer = statePainter => args => {
    if (args.positionInCircuit === undefined) {
        DISPLAY_GATE_DEFAULT_DRAWER(args);
        return;
    }

    statePainter(args);

    if (args.isHighlighted) {
        rectangle(args.painter, args.rect, {stroke: {color: CanvasTheme.text.primary, width: 1.5}});
    }

    // Draw the tab once, above the display, with its normal/highlight opacity.
    GatePainting.paintResizeTab(args);
};

/**
 * @param {!GateDrawParams} args
 */
GatePainting.MATRIX_DRAWER = args => {
    let m = args.gate.knownMatrixAt(args.stats.time);
    if (m === undefined) {
        GatePainting.DEFAULT_DRAWER(args);
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
            rectangle(painter, args.rect, {
                fill: CanvasTheme.gate.hover
            });
        });
    }
    GatePainting.paintOutline(args);
};

/**
 * @param {!number=} xScale
 * @param {!number=} yScale
 * @param {!number=} tScale
 * @param {!number=} zeroAngle
 * @returns {!function(!GateDrawParams) : *}
 */
GatePainting.makeCycleDrawer = (xScale=1, yScale=1, tScale=1, zeroAngle=0) => args => {
    // The clock marks time dependence while the fill retains the operation family.
    GatePainting.DEFAULT_DRAWER(args);
    GatePainting.paintCycleState(args, args.stats.time * 2 * Math.PI * tScale, xScale, yScale, zeroAngle);
};

/**
 * @param {!GateDrawParams} args
 * @param {!number} angle
 * @param {!number} xScale
 * @param {!number} yScale
 * @param {!number} zeroAngle
 */
GatePainting.paintCycleState = (args, angle, xScale=1, yScale=1, zeroAngle=0) => {
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
            path.stroke({
                color: CanvasTheme.text.primary,
                width: 1
            }).fill(CanvasTheme.operation.fill);
        });
    });
};

/**
 * @param {!GateDrawParams} args
 * @param {!int} offset
 * @returns {!number}
 */
function _wireY(args, offset) {
    return args.rect.center().y + (offset - args.gate.height/2 + 0.5) * Layout.WIRE_SPACING;
}

/**
 * @param {!Rect} wholeRect
 * @returns {!Rect}
 */

/**
 * @param {!GateDrawParams} args
 */
GatePainting.paintGateButton = args => {
    if (!args.isHighlighted || args.hand.isHoldingSomething()) {
        return;
    }

    let buttonRect = gateButtonRect(args.rect);
    let buttonFocus = !args.focusPoints.every(pt => !buttonRect.containsPoint(pt));
    rectangle(args.painter, buttonRect, {fill: buttonFocus ? CanvasTheme.interaction.buttonFocus : CanvasTheme.interaction.button});
    fitText(args.painter, 'change', {
        x: buttonRect.center().x,
        y: buttonRect.center().y,
        align: 'center',
        baseline: 'middle',
        fill: CanvasTheme.text.onBright,
        font: {fontSize: 12, fontFamily: Typography.DEFAULT_FONT_FAMILY},
        width: buttonRect.w,
        height: buttonRect.h
    });
    rectangle(args.painter, buttonRect, {stroke: {color: CanvasTheme.text.primary, width: 1}});
};

/**
 * @param {!GateDrawParams} args
 */
function _eraseWiresForPermutation(args) {
    for (let i = 0; i < args.gate.height; i++) {
        let y = _wireY(args, i);
        let p = new Point(args.rect.x, y);
        let c = new Point(args.rect.x + Layout.GATE_RADIUS, y);
        let q = new Point(args.rect.right(), y);
        let loc = new Point(args.positionInCircuit.col, args.positionInCircuit.row + i);
        let isMeasured1 = args.stats.circuitDefinition.locIsMeasured(loc);
        let isMeasured2 = args.stats.circuitDefinition.locIsMeasured(loc.offsetBy(1, 0));

        for (let dy of isMeasured1 ? [-1, +1] : [0]) {
            strokePath(args.painter, [p.offsetBy(0, dy), c.offsetBy(1, dy)], CanvasTheme.surface.background, 1);
        }
        for (let dy of isMeasured2 ? [-1, +1] : [0]) {
            strokePath(args.painter, [c.offsetBy(-1, dy), q.offsetBy(0, dy)], CanvasTheme.surface.background, 1);
        }
    }
}

/**
 * Draws the gate as a re-arrangement of wires.
 * @param {!GateDrawParams} args
 */
GatePainting.PERMUTATION_DRAWER = args => {
    if (args.positionInCircuit === undefined) {
        GatePainting.DEFAULT_DRAWER(args);
        return;
    }

    if (args.isHighlighted ||
            args.isResizeHighlighted ||
            args.stats.circuitDefinition.colHasControls(args.positionInCircuit.col)) {
        GatePainting.paintBackground(args, CanvasTheme.surface.quiet);
        GatePainting.paintOutline(args);
        GatePainting.paintResizeTab(args);
    } else {
        _eraseWiresForPermutation(args);
    }

    // Draw wires.
    let x1 = args.rect.x;
    let x2 = args.rect.right();
    for (let i = 0; i < args.gate.height; i++) {
        let j = args.gate.knownBitPermutationFunc(i);

        let pt = new Point(args.positionInCircuit.col, args.positionInCircuit.row + i);
        let isMeasured = args.stats.circuitDefinition.locIsMeasured(pt);
        let y1 = _wireY(args, i);
        let y2 = _wireY(args, j);
        const path = args.painter.graphics();
        for (let [dx, dy] of isMeasured ? [[j > i ? +1 : -1, -1], [0, +1]] : [[0, 0]]) {
            path.moveTo(Math.min(x1, x1 + dx), y1 + dy);
            path.lineTo(x1 + dx, y1 + dy);
            path.lineTo(x2 + dx, y2 + dy);
            path.lineTo(Math.max(x2, x2 + dx), y2 + dy);
        }
        path.stroke({color: CanvasTheme.text.primary, width: 1});
    }
};

export {GatePainting}
