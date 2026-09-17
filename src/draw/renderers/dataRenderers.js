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
import {paintMatrix} from '../displays/complex/MatrixView.js';
import {drawGraphics} from '../scene/DisplayView.js';
import {Color} from 'pixi.js';
import {PathGeometry} from '../shapes/PathGeometry.js';
import {drawPath, rectangle} from '../shapes/ShapeView.js';
import {drawText, fitText, fitParagraph, measureText} from '../text/TextLayout.js';
import {paintDensityMatrix} from '../displays/density/DensityMatrixView.js';
import {ZERO_PROBABILITY, formatProbability, largestProbability, probabilityBarFraction}
    from '../displays/probability/ProbabilityScale.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Typography} from '../../config/Typography.js';
import {Format} from '../../base/Format.js';
import { bin } from "../../base/Format.js";
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

/** Edge labels need a view at least this large on its shorter side; smaller views keep tooltips only. */
const MIN_EDGE_LABELLED_SIDE = 100;
const EDGE_LABEL_FONT = {fontSize: 9, fontFamily: Typography.MONO_FONT_FAMILY};

/** A state grid's rows carry the high bits of the basis state and its columns the low bits. */
function stateAxisBits(matrix) {
    return {rowBits: Math.round(Math.log2(matrix.height())), colBits: Math.round(Math.log2(matrix.width()))};
}

/** Square cells centred in `area`. */
function fitCells(matrix, area) {
    const diam = Math.min(area.w / matrix.width(), area.h / matrix.height());
    const w = diam * matrix.width();
    const h = diam * matrix.height();
    return new Rect(area.x + (area.w - w) / 2, area.y + (area.h - h) / 2, w, h);
}

/**
 * Where a state's cells go inside `area`: square cells, centred, never past its edges. Cells too
 * small to name their own basis state leave a band left of the grid for each row's high bits and
 * one above it for each column's low bits, the way the circuit's output grid labels itself.
 *
 * @param {!Matrix} matrix
 * @param {!Rect} area
 * @returns {!{grid: !Rect, block: !Rect, edgeLabels: !boolean}} The cells, and all that is drawn.
 */
function stateGridRect(matrix, area) {
    const cells = fitCells(matrix, area);
    if (cells.w / matrix.width() >= MIN_LABELLED_CELL_SIZE || Math.min(area.w, area.h) < MIN_EDGE_LABELLED_SIDE) {
        return {grid: cells, block: cells, edgeLabels: false};
    }
    const left = Math.ceil(measureText(bin(0, stateAxisBits(matrix).rowBits) + '⋯', EDGE_LABEL_FONT).width) + 6;
    const top = EDGE_LABEL_FONT.fontSize + 8;
    const grid = fitCells(matrix, new Rect(area.x + left, area.y + top, area.w - left, area.h - top));
    return {grid, block: new Rect(grid.x - left, grid.y - top, grid.w + left, grid.h + top), edgeLabels: true};
}

/** Each row's high bits left of the grid and each column's low bits above it, sparse where they would collide. */
function stateEdgeLabels(view, matrix, grid) {
    const {rowBits, colBits} = stateAxisBits(matrix);
    const cell = grid.w / matrix.width();
    const font = EDGE_LABEL_FONT;
    const columnLabel = c => '⋯' + bin(c, colBits);
    const columnStride = Math.max(1, Math.ceil((measureText(columnLabel(0), font).width + 4) / cell));
    const rowStride = Math.max(1, Math.ceil((font.fontSize + 3) / cell));
    view.group('edge-labels', view => {
        for (let c = 0; c < matrix.width(); c += columnStride) {
            drawText(view, columnLabel(c), {x: grid.x + (c + 0.5) * cell, y: grid.y - 3, align: 'center',
                baseline: 'bottom', font});
        }
        for (let r = 0; r < matrix.height(); r += rowStride) {
            drawText(view, bin(r, rowBits) + '⋯', {x: grid.x - 3, y: grid.y + (r + 0.5) * cell, align: 'right',
                baseline: 'middle', font});
        }
    });
}

/**
 * A state: amplitudes as discs and white phase hands, each cell named by its basis state, or its
 * rows and columns named at the grid's edges when cells are too small to hold a name.
 *
 * @param {!DisplayView} view
 * @param {!Matrix} matrix The amplitudes, already laid out (see stateGrid for the circuit's layout).
 * @param {!Rect} rect
 * @param {!{wireCount: !int, focusPoints: (undefined|!Array.<!Point>), coherent: (undefined|!boolean),
 *     indicatorAlpha: (undefined|!number), phaseLockIndex: (undefined|!int),
 *     registers: (undefined|!Registers)}} options `registers` are the state's wires' own, numbered
 *     from its first wire; the basis states read in their words.
 * @returns {!{grid: !Rect, block: !Rect, edgeLabels: !boolean}} See stateGridRect.
 */
function renderState(view, matrix, rect, {wireCount, focusPoints = [], coherent = true, indicatorAlpha = 1,
                                          phaseLockIndex = undefined, registers = Registers.EMPTY}) {
    const layout = stateGridRect(matrix, rect);
    const {grid} = layout;
    if (layout.edgeLabels) {
        rectangle(view, layout.block, {fill: CanvasTheme.amplitude.background});
    }
    // The hand is white whatever the phase; it only fades as the phases stop being defined.
    const handColor = indicatorAlpha >= 1 ? CanvasTheme.text.primary :
        indicatorAlpha > 0 ? new Color(CanvasTheme.text.primary).setAlpha(indicatorAlpha).toRgbaString() :
        undefined;
    paintMatrix(view, matrix, grid, {
        wireCount,
        amplitudeCircleFillColor: CanvasTheme.amplitude.circle,
        amplitudeCircleStrokeColor: CanvasTheme.text.primary,
        amplitudeProbabilityFillColor: CanvasTheme.amplitude.fill,
        backColor: CanvasTheme.amplitude.background,
        phaseColorForDegrees: () => handColor
    });

    const index = (c, r) => r*matrix.width() + c;
    const basis = i => ketLabel(registers, wireCount, i);
    if (layout.edgeLabels) {
        stateEdgeLabels(view, matrix, grid);
    } else {
        stateCellLabels(view, matrix, grid, basis);
    }

    const forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    if (!coherent) {
        paintMatrixTooltip(view, matrix, grid, focusPoints,
            (c, r) => `Chance of |${basis(index(c, r))}⟩ (decimal ${index(c, r)}) [amplitude not defined]`,
            (c, r, v) => `raw: ${(v.norm2()*100).toFixed(4)}%, log: ${(Math.log10(v.norm2())*10).toFixed(1)} dB`,
            () => '[entangled with other qubits]');
        return layout;
    }
    paintMatrixTooltip(view, matrix, grid, focusPoints,
        (c, r) => `Amplitude of |${basis(index(c, r))}⟩ (decimal ${index(c, r)})`,
        (c, r, v) => 'val:' + v.toString(Format.SIMPLIFIED),
        (c, r, v) => `mag²:${(v.norm2()*100).toFixed(4)}%, phase:${forceSign(v.phase() * 180 / Math.PI)}°`);
    if (phaseLockIndex !== undefined && indicatorAlpha > 0) {
        // The cell whose phase was taken as zero, which every other hand is measured from: it wears
        // the reference ink, and the gate's caption names it.
        const diam = grid.w / matrix.width();
        const c = phaseLockIndex % matrix.width();
        const r = Math.floor(phaseLockIndex / matrix.width());
        rectangle(view, new Rect(grid.x + diam*c, grid.y + diam*r, diam, diam),
            {stroke: {color: CanvasTheme.amplitude.reference, width: 1}});
    }
    return layout;
}

// ---- probabilities ------------------------------------------------------------------------------

/** The shortest bar a possible outcome gets. */
const MIN_BAR_LENGTH = 1;
/** Rows at least this tall get a divider and a gap between bars; thinner rows would be all divider. */
const MIN_DIVIDED_ROW_HEIGHT = 4;
/** Rows sharing leading bits group together until the group is this tall, room for its prefix. */
const MIN_GROUP_HEIGHT = 24;
/** The gap bars leave at a group's edge, where the group's divider shows through. */
const GROUP_GAP = 3;
/** The strip left of the chart that a group's prefix label may take. */
const PREFIX_LABEL_WIDTH = 36;
const PREFIX_FONT = {fontSize: 9, fontFamily: Typography.MONO_FONT_FAMILY};
const KET_FONT = {fontSize: 10, fontFamily: Typography.MONO_FONT_FAMILY};

/**
 * @returns {undefined|"side"|"stacked"} Where the rows carry their kets, if they have room: beside the
 *     percentage in a wide chart, or above it in a tall row.
 */
function ketLayout(rect, wireCount) {
    const d = rect.h / (1 << wireCount);
    if (d <= 8) {
        return undefined;
    }
    if (rect.w >= measureText(`|${bin(0, wireCount)}⟩ 100.0%`, KET_FONT).width + 4) {
        return "side";
    }
    return d >= 26 ? "stacked" : undefined;
}

/**
 * @returns {!int} How many rows form a group sharing their leading bits: the fewest, a power of two,
 *     tall enough to label. All the rows when no smaller group is.
 */
function groupRowCount(rect, wireCount) {
    const n = 1 << wireCount;
    let rows = 2;
    while (rows < n && rows * rect.h / n < MIN_GROUP_HEIGHT) {
        rows *= 2;
    }
    return Math.min(rows, n);
}

function probabilityGrid(view, rect, wireCount, groupRows) {
    const {x, y, w, h} = rect;
    const n = 1 << wireCount;
    const d = h / n;
    rectangle(view, rect, {fill: CanvasTheme.probability.background});
    if (d >= MIN_DIVIDED_ROW_HEIGHT) {
        drawPath(view, tracer => {
            for (let i = 1; i < n; i++) {
                if (i % groupRows !== 0) PathGeometry.line(tracer, x, y + d * i, x + w, y + d * i);
            }
        }, [{stroke: {color: CanvasTheme.stroke.grid, width: 1}}]);
    }
    if (groupRows < n) {
        drawPath(view, tracer => {
            for (let i = groupRows; i < n; i += groupRows) PathGeometry.line(tracer, x, y + d * i, x + w, y + d * i);
        }, [{stroke: {color: CanvasTheme.stroke.guide, width: 2}}]);
    }
    rectangle(view, rect, {stroke: {color: CanvasTheme.stroke.grid, width: 1}});
}

function probabilityBars(view, rect, probabilities, wireCount, largest, groupRows, colour = CanvasTheme.probability.bar) {
    const {x, y, w, h} = rect;
    const n = 1 << wireCount;
    const d = h / n;
    const buffer = probabilities.rawBuffer();
    // A possible outcome keeps at least a pixel of bar, so it never looks like an impossible one.
    const length = i => buffer[i * 2] > ZERO_PROBABILITY ?
        Math.max(MIN_BAR_LENGTH, w * probabilityBarFraction(buffer[i * 2], largest)) : 0;
    const groupEdge = i => i > 0 && i < n && i % groupRows === 0;
    drawGraphics(view, graphics => {
        if (d >= MIN_DIVIDED_ROW_HEIGHT) {
            // A bar per row, short of the row's dividers, so equal neighbours still read as two rows.
            for (let i = 0; i < n; i++) {
                const top = i === 0 ? 0 : groupEdge(i) ? GROUP_GAP / 2 : 0.5;
                const bottom = i === n - 1 ? 0 : groupEdge(i + 1) ? GROUP_GAP / 2 : 0.5;
                if (length(i) > 0) graphics.rect(x, y + d * i + top, length(i), d - top - bottom);
            }
        } else {
            // Rows too thin to divide draw as one outline per group, broken where the groups meet.
            for (let start = 0; start < n; start += groupRows) {
                const end = start + groupRows;
                const top = y + d * start + (groupEdge(start) ? GROUP_GAP / 2 : 0);
                const bottom = y + d * end - (groupEdge(end) ? GROUP_GAP / 2 : 0);
                graphics.moveTo(x, top);
                for (let i = start; i < end; i++) {
                    graphics.lineTo(x + length(i), Math.max(top, y + d * i));
                    graphics.lineTo(x + length(i), Math.min(bottom, y + d * (i + 1)));
                }
                graphics.lineTo(x, bottom);
                graphics.closePath();
            }
        }
        graphics.fill(colour);
    });
}

/**
 * Left of the chart, each group's shared leading bits: 01⋯ for the rows whose kets start 01. Plates
 * keep the labels clear of the wires they cross.
 */
function probabilityGroupLabels(view, rect, wireCount, groupRows) {
    const n = 1 << wireCount;
    const d = rect.h / n;
    const prefixBits = wireCount - Math.log2(groupRows);
    for (let start = 0; start < n; start += groupRows) {
        const cy = rect.y + d * (start + groupRows / 2);
        fitText(view, bin(start / groupRows, prefixBits) + '⋯', {
            x: rect.x - 3, y: cy, align: 'right', baseline: 'middle', font: PREFIX_FONT,
            fill: CanvasTheme.text.muted, width: PREFIX_LABEL_WIDTH, height: d * groupRows,
            beforeDraw: (textWidth, textHeight) => rectangle(view,
                new Rect(rect.x - 4 - textWidth, cy - textHeight / 2, textWidth + 2, textHeight),
                {fill: CanvasTheme.surface.background}),
        });
    }
}

function probabilityTooltips(view, rect, probabilities, wireCount, focusPoints, wireNames) {
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
                labelText: wireNames === undefined ?
                    `Chance of |${bin(k, wireCount)}⟩ (decimal ${k}) if measured` :
                    `Chance of |${bin(k, wireCount)}⟩ on ${wireNames.join('')} if measured`,
                valueText: 'raw: ' + (p * 100).toFixed(4) + "%",
                valueText2: 'log: ' + (Math.log10(p) * 10).toFixed(1) + " dB"
            });
        }
    }
}

function probabilityTexts(view, rect, probabilities, kets) {
    const {x, y, w, h} = rect;
    const n = probabilities.height();
    const bits = Math.round(Math.log2(n));
    const d = h / n;
    const stacked = kets === "stacked";
    for (let i = 0; i < n; i++) {
        const p = probabilities.rawBuffer()[i * 2];
        if (kets !== undefined) fitText(view, `|${bin(i, bits)}⟩`, {
            x: stacked ? x+w/2 : x+2, y: y+d*(i+0.5)-(stacked ? 6 : 0),
            align: stacked ? 'center' : 'left', baseline: 'middle', font: KET_FONT,
            fill: CanvasTheme.text.primary, width: stacked ? w-4 : w/2, height: 12,
        });
        // An impossible outcome's 0% steps back, so the outcomes that can happen stand out.
        fitText(view, formatProbability(p), {
            x: x + w - 2,
            y: y + d * (i + 0.5) + (stacked ? 6 : 0),
            align: 'right',
            baseline: 'middle',
            fill: p > ZERO_PROBABILITY ? CanvasTheme.text.primary : CanvasTheme.text.muted,
            font: {fontSize: 10.666666666666666, fontFamily: Typography.MONO_FONT_FAMILY},
            width: w - 4,
            height: d
        });
    }
}

/**
 * A probability distribution over basis states: a bar per state in index order, with its
 * percentage where the rows are tall enough to hold one. A full bar is the largest probability and
 * each bar is the square root of its share of that (src/draw/displays/probability/ProbabilityScale.js),
 * so a small chance still has a bar and one scale serves every row height.
 *
 * Rows too small to carry their kets group by their leading bits: a divider every 2, 4, 8… rows,
 * the fewest that stay tall enough to label, and the group's prefix beside it when asked for.
 *
 * @param {!DisplayView} view
 * @param {undefined|!Matrix} probabilities A column whose real parts are the probabilities.
 * @param {!Rect} rect
 * @param {!{wireCount: !int, focusPoints: (undefined|!Array.<!Point>), largest: (undefined|!number),
 *     groupLabels: (undefined|!boolean), wireNames: (undefined|!Array.<!string>)}} options
 *     largest sets what a full bar stands for, so distributions drawn over each other share a scale.
 *     groupLabels draws each group's prefix left of the chart, outside rect.
 *     wireNames, highest wire first, says in tooltips which wires the kets are over.
 */
function renderProbabilities(view, probabilities, rect, {wireCount, focusPoints = [], colour,
        transparent = false, largest, groupLabels = false, wireNames}) {
    const kets = ketLayout(rect, wireCount);
    const n = 1 << wireCount;
    const groupRows = kets === undefined ? groupRowCount(rect, wireCount) : n;
    if (!transparent) probabilityGrid(view, rect, wireCount, groupRows);
    if (probabilities === undefined || probabilities.hasNaN()) {
        fitParagraph(view, "NaN", rect, {alignment: new Point(0.5, 0.5), fill: CanvasTheme.error.text});
    } else {
        probabilityBars(view, rect, probabilities, wireCount, largest ?? largestProbability(probabilities),
            groupRows, colour);
        if (rect.h / probabilities.height() > 8) {
            probabilityTexts(view, rect, probabilities, kets);
        }
        if (groupLabels && groupRows < n) {
            probabilityGroupLabels(view, rect, wireCount, groupRows);
        }
    }
    probabilityTooltips(view, rect, probabilities, wireCount, focusPoints, wireNames);
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

export {DATA_RENDERERS, stateGrid, stateGridRect};
