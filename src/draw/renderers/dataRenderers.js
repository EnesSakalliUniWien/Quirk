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

import {TooltipLayer} from '../tooltips/TooltipView.js';
import {paintMatrixTooltip} from '../tooltips/MatrixTooltip.js';
import {paintMatrix} from '../displays/MatrixView.js';
import {drawGraphics} from '../scene/DisplayView.js';
import {Color} from 'pixi.js';
import {PathGeometry} from '../shapes/PathGeometry.js';
import {drawPath, rectangle} from '../shapes/ShapeView.js';
import {fitText, fitParagraph, measureText} from '../text/TextLayout.js';
import {paintDensityMatrix} from '../displays/DensityMatrixView.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Typography} from '../../config/Typography.js';
import {Format} from '../../base/Format.js';
import {Util} from '../../base/Util.js';
import {Registers} from '../../circuit/model/Registers.js';
import {ketLabel} from '../../circuit/registerLabels.js';
import {Matrix} from '../../engine/math/matrix/Matrix.js';
import {Point} from '../../geometry/Point.js';
import {Rect} from '../../geometry/Rect.js';

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
    paintMatrix(view, matrix, rect, {
        amplitudeCircleFillColor: CanvasTheme.operation.fill,
        amplitudeCircleStrokeColor: CanvasTheme.text.primary,
        backColor: CanvasTheme.operation.background,
        showLogCircles: false
    });
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

/** The least a cell may measure to carry its basis state, and the least its label may shrink to. */
const MIN_LABELLED_CELL_SIZE = 24;
const MIN_CELL_LABEL_FONT_SIZE = 7;
const CELL_LABEL_FONT = {fontSize: 11, fontFamily: Typography.MONO_FONT_FAMILY};
const CELL_LABEL_INSET = 2;

/**
 * Each cell's basis state in its corner, in the register's words, where the cells are big enough
 * to carry one. The circuit's own grid labels its rows and columns outside itself; a gate has no
 * room beside it, so its cells say what they are. The label sits on the plate every canvas label
 * sits on, so it reads the same over the disc as over the ground.
 *
 * @param {!DisplayView} view
 * @param {!Matrix} matrix
 * @param {!Rect} rect
 * @param {!function(!int): !string} label The basis state at an index of the grid, row-major.
 */
function stateCellLabels(view, matrix, rect, label) {
    const diam = Math.min(rect.w / matrix.width(), rect.h / matrix.height());
    if (diam < MIN_LABELLED_CELL_SIZE) {
        return;
    }
    const room = diam - 2*CELL_LABEL_INSET;
    view.group('cell-labels', view => {
        for (let r = 0; r < matrix.height(); r++) {
            for (let c = 0; c < matrix.width(); c++) {
                const text = label(r*matrix.width() + c);
                const scale = Math.min(1, room / measureText(text, CELL_LABEL_FONT).width);
                if (scale * CELL_LABEL_FONT.fontSize < MIN_CELL_LABEL_FONT_SIZE) {
                    continue;
                }
                const x = rect.x + diam*c + CELL_LABEL_INSET;
                const y = rect.y + diam*r + CELL_LABEL_INSET;
                fitText(view, text, {
                    x,
                    y,
                    align: 'left',
                    baseline: 'top',
                    fill: CanvasTheme.text.primary,
                    font: CELL_LABEL_FONT,
                    width: room,
                    beforeDraw: (w, h) => rectangle(view, new Rect(x - 1, y, w + 2, h), {fill: CanvasTheme.surface.gate})
                });
            }
        }
    });
}

/**
 * A state: amplitudes as discs and white phase hands, each cell named by its basis state.
 *
 * @param {!DisplayView} view
 * @param {!Matrix} matrix The amplitudes, already laid out (see stateGrid for the circuit's layout).
 * @param {!Rect} rect
 * @param {!{wireCount: !int, focusPoints: (undefined|!Array.<!Point>), coherent: (undefined|!boolean),
 *     indicatorAlpha: (undefined|!number), phaseLockIndex: (undefined|!int),
 *     registers: (undefined|!Registers)}} options `registers` are the state's wires' own, numbered
 *     from its first wire; the basis states read in their words.
 */
function renderState(view, matrix, rect, {wireCount, focusPoints = [], coherent = true, indicatorAlpha = 1,
                                          phaseLockIndex = undefined, registers = Registers.EMPTY}) {
    // The hand is white whatever the phase; it only fades as the phases stop being defined.
    const handColor = indicatorAlpha >= 1 ? CanvasTheme.text.primary :
        indicatorAlpha > 0 ? new Color(CanvasTheme.text.primary).setAlpha(indicatorAlpha).toRgbaString() :
        undefined;
    paintMatrix(view, matrix, rect, {
        amplitudeCircleFillColor: CanvasTheme.amplitude.circle,
        amplitudeCircleStrokeColor: CanvasTheme.text.primary,
        amplitudeProbabilityFillColor: CanvasTheme.amplitude.fill,
        backColor: CanvasTheme.amplitude.background,
        phaseColorForDegrees: () => handColor
    });

    const index = (c, r) => r*matrix.width() + c;
    const basis = i => ketLabel(registers, wireCount, i);
    stateCellLabels(view, matrix, rect, basis);

    const forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    if (!coherent) {
        paintMatrixTooltip(view, matrix, rect, focusPoints,
            (c, r) => `Chance of |${basis(index(c, r))}⟩ (decimal ${index(c, r)}) [amplitude not defined]`,
            (c, r, v) => `raw: ${(v.norm2()*100).toFixed(4)}%, log: ${(Math.log10(v.norm2())*10).toFixed(1)} dB`,
            () => '[entangled with other qubits]');
        return;
    }
    paintMatrixTooltip(view, matrix, rect, focusPoints,
        (c, r) => `Amplitude of |${basis(index(c, r))}⟩ (decimal ${index(c, r)})`,
        (c, r, v) => 'val:' + v.toString(Format.SIMPLIFIED),
        (c, r, v) => `mag²:${(v.norm2()*100).toFixed(4)}%, phase:${forceSign(v.phase() * 180 / Math.PI)}°`);
    if (phaseLockIndex !== undefined && indicatorAlpha > 0) {
        // The cell whose phase was taken as zero, which every other hand is measured from: it wears
        // the reference ink, and the gate's caption names it.
        const diam = Math.min(rect.w / matrix.width(), rect.h / matrix.height());
        const c = phaseLockIndex % matrix.width();
        const r = Math.floor(phaseLockIndex / matrix.width());
        rectangle(view, new Rect(rect.x + diam*c, rect.y + diam*r, diam, diam),
            {stroke: {color: CanvasTheme.amplitude.reference, width: 1}});
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

function probabilityBars(view, rect, probabilities, wireCount, colour = CanvasTheme.probability.fill) {
    const {x, y, w, h} = rect;
    const n = 1 << wireCount;
    const d = h / n;
    const e = Math.max(d, 1);
    drawGraphics(view, path => {
    path.moveTo(x, y);
    for (let i = 0; i < n; i++) {
        const p = probabilities.rawBuffer()[i * 2];
        path.lineTo(x + w * p, y + d * i);
        path.lineTo(x + w * p, y + d * i + e);
    }
    path.lineTo(x, y + h);
    path.lineTo(x, y);
    path.stroke({color: CanvasTheme.stroke.guide, width: 1}).fill(colour);
    });
}

function probabilityLogarithmHints(view, rect, probabilities, wireCount) {
    const {x, y, w, h} = rect;
    const n = 1 << wireCount;
    const d = h / n;
    const e = Math.max(d, 1);
    drawGraphics(view, path => {
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
    });
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
            TooltipLayer.forView(view).show(view, {
                x: x + w,
                y: y + k * d,
                labelText: `Chance of |${Util.bin(k, wireCount)}⟩ (decimal ${k}) if measured`,
                valueText: 'raw: ' + (p * 100).toFixed(4) + "%",
                valueText2: 'log: ' + (Math.log10(p) * 10).toFixed(1) + " dB"
            });
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
function renderProbabilities(view, probabilities, rect, {wireCount, focusPoints = [], colour, transparent = false}) {
    if (!transparent) probabilityGrid(view, rect, wireCount);
    if (probabilities === undefined || probabilities.hasNaN()) {
        fitParagraph(view, "NaN", rect, {alignment: new Point(0.5, 0.5), fill: CanvasTheme.error.text});
    } else {
        const textFits = rect.h / probabilities.height() > 8;
        if (!textFits) {
            probabilityLogarithmHints(view, rect, probabilities, wireCount);
        }
        probabilityBars(view, rect, probabilities, wireCount, colour);
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
