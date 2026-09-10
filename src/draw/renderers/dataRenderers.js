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

import {PathGeometry} from '../pixi/PathGeometry.js';
import {drawPath, rectangle, strokePath} from '../pixi/ShapeView.js';
import {fitText, fitParagraph} from '../pixi/TextLayout.js';
import {paintDensityMatrix} from '../pixi/displays/DensityMatrixView.js';
import {CanvasTheme, phaseColor} from '../../config/CanvasTheme.js';
import {Typography} from '../../config/Typography.js';
import {Format} from '../../base/Format.js';
import {Util} from '../../base/Util.js';
import {Matrix} from '../../engine/math/matrix/Matrix.js';
import {Point} from '../../geometry/Point.js';
import {Rect} from '../../geometry/Rect.js';
import {MathPainter} from '../MathPainter.js';

/**
 * How each kind of data is drawn, whoever produced it.
 *
 * A display gate in the circuit and a panel beside it used to draw the same kind of data in two
 * different ways. Here a renderer is chosen by what the data *is* - a matrix, a state, a
 * probability distribution - the way VS Code picks a notebook renderer by MIME type or Unity picks a
 * property drawer by type. The gate renderers in src/draw/gate feed these from a gate's stats; the
 * panels feed them from the simulator directly. Both get the same picture.
 *
 * Every renderer draws into a retained pixi DisplayView, inside a rect, from plain data.
 */

// ---- matrix -------------------------------------------------------------------------------------

/**
 * A matrix, one cell per entry: a disc whose area is the magnitude and a hand for the phase.
 *
 * @param {!DisplayView} view
 * @param {!Matrix} matrix
 * @param {!Rect} rect
 * @param {!{style: (undefined|"operator"|"density"), focusPoints: (undefined|!Array.<!Point>)}=} options
 *     "density" draws the coherences of a density matrix; "operator", the default, draws an operator.
 */
function renderMatrix(view, matrix, rect, {style = "operator", focusPoints = []} = {}) {
    if (style === "density") {
        paintDensityMatrix(view, matrix, rect, focusPoints);
        return;
    }
    MathPainter.paintMatrix(
        view,
        matrix,
        rect,
        CanvasTheme.operation.fill,
        CanvasTheme.text.primary,
        undefined,
        CanvasTheme.operation.background,
        undefined,
        CanvasTheme.transparent);
}

// ---- state --------------------------------------------------------------------------------------

/**
 * A state's amplitudes as the grid the amplitude display uses: rows of 2^⌈n/2⌉... well, the same
 * split the circuit makes, so a state reads the same in a panel as on the canvas. The buffer order
 * is already the grid's row-major order, so this is a reshape, not a copy of the arithmetic.
 *
 * @param {!Matrix} vector A column vector over some number of qubits.
 * @returns {!Matrix}
 */
function stateGrid(vector) {
    const size = vector.height();
    const qubits = Math.round(Math.log2(size));
    const width = qubits === 1 ? 2 : 1 << Math.floor(qubits / 2);
    return new Matrix(width, size / width, new Float64Array(vector.rawBuffer()));
}

/**
 * A state: amplitudes as discs and phase hands, coloured by phase while the state is coherent.
 *
 * @param {!DisplayView} view
 * @param {!Matrix} matrix The amplitudes, already laid out (see stateGrid for the circuit's layout).
 * @param {!Rect} rect
 * @param {!{wireCount: !int, focusPoints: (undefined|!Array.<!Point>), coherent: (undefined|!boolean),
 *     indicatorAlpha: (undefined|!number), phaseLockIndex: (undefined|!int)}} options
 */
function renderState(view, matrix, rect, {wireCount, focusPoints = [], coherent = true, indicatorAlpha = 1,
                                          phaseLockIndex = undefined}) {
    MathPainter.paintMatrix(
        view,
        matrix,
        rect,
        CanvasTheme.amplitude.circle,
        CanvasTheme.text.primary,
        CanvasTheme.amplitude.fill,
        CanvasTheme.amplitude.background,
        phase => indicatorAlpha > 0 ? phaseColor(phase, indicatorAlpha) : undefined);

    const forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    const basis = (c, r) => Util.bin(r*matrix.width() + c, wireCount);
    if (!coherent) {
        MathPainter.paintMatrixTooltip(view, matrix, rect, focusPoints,
            (c, r) => `Chance of |${basis(c, r)}⟩ (decimal ${r*matrix.width() + c}) [amplitude not defined]`,
            (c, r, v) => `raw: ${(v.norm2()*100).toFixed(4)}%, log: ${(Math.log10(v.norm2())*10).toFixed(1)} dB`,
            () => '[entangled with other qubits]');
        return;
    }
    MathPainter.paintMatrixTooltip(view, matrix, rect, focusPoints,
        (c, r) => `Amplitude of |${basis(c, r)}⟩ (decimal ${r*matrix.width() + c})`,
        (c, r, v) => 'val:' + v.toString(new Format(false, 0, 5, ", ")),
        (c, r, v) => `mag²:${(v.norm2()*100).toFixed(4)}%, phase:${forceSign(v.phase() * 180 / Math.PI)}°`);
    if (phaseLockIndex !== undefined && indicatorAlpha > 0) {
        const cw = rect.w/matrix.width();
        const rh = rect.h/matrix.height();
        const c = phaseLockIndex % matrix.width();
        const r = Math.floor(phaseLockIndex / matrix.width());
        const cx = rect.x + cw*(c+0.5);
        const cy = rect.y + rh*(r+0.5);
        strokePath(view, [new Point(cx, cy), new Point(cx + cw/2, cy)], CanvasTheme.amplitude.reference, 2);
        fitText(view, 'fixed', {
            x: cx + 0.5*cw,
            y: cy,
            align: 'right',
            baseline: 'bottom',
            fill: CanvasTheme.amplitude.reference,
            font: {fontSize: 12, fontFamily: Typography.MONO_FONT_FAMILY},
            width: cw*0.5,
            height: rh*0.5,
            beforeDraw: (w, h) => rectangle(view, new Rect(cx + cw/2 - w, cy - h, w, h), {fill: CanvasTheme.surface.gate})
        });
    }
}

// ---- probabilities ------------------------------------------------------------------------------

function probabilityGrid(view, rect, wireCount) {
    const {x, y, w, h} = rect;
    const n = 1 << wireCount;
    const d = h / n;
    rectangle(view, rect, {fill: CanvasTheme.probability.background});

    if (d < 1) {
        view.group('dense-grid-' + view.order, painter => {
            painter.alpha *= 0.2;
            rectangle(painter, rect, {fill: CanvasTheme.stroke.grid});
        });
        return;
    }
    const r = wireCount - 5;
    drawPath(view, tracer => {
        for (let i = 1; i < n; i++) {
            PathGeometry.line(tracer, x, y + d * i, x + w, y + d * i);
        }
    }, [{stroke: {color: CanvasTheme.stroke.grid, width: r <= 0 ? 1 : 1 / r}}]);
    rectangle(view, rect, {stroke: {color: CanvasTheme.stroke.grid, width: 1}});
}

function probabilityBars(view, rect, probabilities, wireCount) {
    const {x, y, w, h} = rect;
    const n = 1 << wireCount;
    const d = h / n;
    const e = Math.max(d, 1);
    const path = view.graphics();
    path.moveTo(x, y);
    for (let i = 0; i < n; i++) {
        const p = probabilities.rawBuffer()[i * 2];
        path.lineTo(x + w * p, y + d * i);
        path.lineTo(x + w * p, y + d * i + e);
    }
    path.lineTo(x, y + h);
    path.lineTo(x, y);
    path.stroke({color: CanvasTheme.stroke.guide, width: 1}).fill(CanvasTheme.probability.fill);
}

function probabilityLogarithmHints(view, rect, probabilities, wireCount) {
    const {x, y, w, h} = rect;
    const n = 1 << wireCount;
    const d = h / n;
    const e = Math.max(d, 1);
    const path = view.graphics();
    path.moveTo(x, y);
    const s = 1 / (4 + Math.max(8, wireCount));
    for (let i = 0; i < n; i++) {
        const p = probabilities.rawBuffer()[i * 2];
        const px = x + w * Math.min(1, Math.max(0, 1 + Math.log(p) * s));
        path.lineTo(px, y + d * i);
        path.lineTo(px, y + d * i + e);
    }
    path.lineTo(x, y + h);
    path.stroke({color: CanvasTheme.stroke.faint, width: 1});
}

function probabilityTooltips(view, rect, probabilities, wireCount, focusPoints) {
    const {x, y, w, h} = rect;
    const n = 1 << wireCount;
    const d = h / n;
    for (const pt of focusPoints) {
        const k = Math.floor((pt.y - y) / d);
        if (rect.containsPoint(pt) && k >= 0 && k < n) {
            const p = probabilities === undefined ? NaN : probabilities.rawBuffer()[k * 2];
            rectangle(view, new Rect(x, y + k * d, w, d), {stroke: {color: CanvasTheme.interaction.outline, width: 2}});
            MathPainter.paintDeferredValueTooltip(
                view,
                x + w,
                y + k * d,
                `Chance of |${Util.bin(k, wireCount)}⟩ (decimal ${k}) if measured`,
                'raw: ' + (p * 100).toFixed(4) + "%",
                'log: ' + (Math.log10(p) * 10).toFixed(1) + " dB");
        }
    }
}

function probabilityTexts(view, rect, probabilities) {
    const {x, y, w, h} = rect;
    const d = h / probabilities.height();
    for (let i = 0; i < probabilities.height(); i++) {
        const p = probabilities.rawBuffer()[i * 2];
        fitText(view, (p * 100).toFixed(1) + "%", {
            x: x + w - 2,
            y: y + d * (i + 0.5),
            align: 'right',
            baseline: 'middle',
            fill: CanvasTheme.text.primary,
            font: {fontSize: 10.666666666666666, fontFamily: Typography.MONO_FONT_FAMILY},
            width: w - 4,
            height: d
        });
    }
}

/**
 * A probability distribution over basis states: a bar per state, with its percentage where the
 * rows are tall enough to hold one and a logarithmic hint where they are not.
 *
 * @param {!DisplayView} view
 * @param {undefined|!Matrix} probabilities A column whose real parts are the probabilities.
 * @param {!Rect} rect
 * @param {!{wireCount: !int, focusPoints: (undefined|!Array.<!Point>)}} options
 */
function renderProbabilities(view, probabilities, rect, {wireCount, focusPoints = []}) {
    probabilityGrid(view, rect, wireCount);
    if (probabilities === undefined || probabilities.hasNaN()) {
        fitParagraph(view, "NaN", rect, {alignment: new Point(0.5, 0.5), fill: CanvasTheme.error.text});
    } else {
        const textFits = rect.h / probabilities.height() > 8;
        if (!textFits) {
            probabilityLogarithmHints(view, rect, probabilities, wireCount);
        }
        probabilityBars(view, rect, probabilities, wireCount);
        if (textFits) {
            probabilityTexts(view, rect, probabilities);
        }
    }
    probabilityTooltips(view, rect, probabilities, wireCount, focusPoints);
}

/**
 * The renderers, by the kind of data they draw. A new kind of data is one entry here.
 *
 * @type {!{matrix: !function, state: !function, probabilities: !function}}
 */
const DATA_RENDERERS = {
    matrix: renderMatrix,
    state: renderState,
    probabilities: renderProbabilities,
};

export {DATA_RENDERERS, stateGrid};
