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

import {wireInitialStateClickableRect} from "./CircuitHitTesting.js"
import {CachablePainting} from "../draw/CachablePainting.js"
import {CircuitStats} from "../circuit/CircuitStats.js"
import {Layout} from "../config/Layout.js"
import {Palette} from "../config/Palette.js"
import {Simulation} from "../config/Simulation.js"
import {Typography} from "../config/Typography.js"
import {Format} from "../base/Format.js"
import {GateColumn} from "../circuit/GateColumn.js"
import {GateDrawParams} from "../draw/GateDrawParams.js"
import {GatePainting} from "../draw/GatePainting.js"
import {Hand} from "../ui/Hand.js"
import {MathPainter} from "../draw/MathPainter.js"
import {Point} from "../math/Point.js"
import {Rect} from "../math/Rect.js"
import {Util} from "../base/Util.js"
import {paintBlochSphereDisplay} from "../gates/displays/BlochSphereDisplay.js"
import {
    SUPERPOSITION_GRID_LABEL_SPAN,
    DISPLAY_CAPTION_WIDTH,
    DISPLAY_CAPTION_GAP,
    DISPLAY_WARNING_STRIP_HEIGHT,
} from "./CircuitLayoutConstants.js"

// One ellipsis stands in for the bits the other axis supplies, keeping labels short enough to read.
const SUPERPOSITION_GRID_LABEL_ELLIPSIS = '⋯';

/**
 * Renders a DisplayedCircuit. These are read-only over the circuit: they paint, they never
 * return a modified one, which is why they live apart from the class that does.
 *
 * This file is the private half of DisplayedCircuit's implementation, split out for size, and the
 * seam between the two is internal: these functions read the circuit's private fields, so nothing
 * here is usable on its own. The module's one interface is DisplayedCircuit.paint, and the one
 * export here is the function backing it.
 */

/**
 * @param {!Painter} painter
 * @param {!number} dy
 * @param {!int} n
 * @param {!function(!int) : !String} labeller
 * @param {!number} boundingWidth
 * @private
 */
function _drawLabelsReasonablyFast(painter, dy, n, labeller, boundingWidth) {
    let ctx = painter.ctx;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    painter.ctx.font = `12px ${Typography.MONO_FONT_FAMILY}`;
    let w = Math.max(
        painter.ctx.measureText(labeller(0)).width,
        painter.ctx.measureText(labeller(n-1)).width);
    let h = ctx.measureText("0").width * 2.5;
    let scale = Math.min(Math.min((boundingWidth-2) / w, dy / h), 1);

    // Row labels.
    let step = dy/scale;
    let pad = 1/scale;
    ctx.scale(scale, scale);
    ctx.translate(0, dy*0.5/scale - h*0.5);
    ctx.fillStyle = Palette.SURFACE_COLOR;
    if (h < step*0.95) {
        for (let i = 0; i < n; i++) {
            ctx.fillRect(0, step*i, w + 2*pad, h);
        }
    } else {
        ctx.fillRect(0, 0, w + 2*pad, step*n);
    }
    ctx.fillStyle = Palette.INK_COLOR;
    for (let i = 0; i < n; i++) {
        ctx.fillText(labeller(i), pad, h*0.5 + step*i);
    }
    ctx.restore();
}

let _cachedRowLabelDrawer = new CachablePainting(
    numWire => ({
        width: SUPERPOSITION_GRID_LABEL_SPAN,
        height: (numWire - 1) * Layout.WIRE_SPACING + Layout.GATE_RADIUS * 2
    }),
    (painter, numWire) => {
        let [colWires, rowWires] = [Math.floor(numWire/2), Math.ceil(numWire/2)];
        let rowCount = 1 << rowWires;
        //noinspection JSCheckFunctionSignatures
        _drawLabelsReasonablyFast(
            painter,
            painter.paintableArea().h / rowCount,
            rowCount,
            // One ellipsis stands in for the bits the column supplies, keeping the label short enough to stay legible.
            i => Util.bin(i, rowWires) + SUPERPOSITION_GRID_LABEL_ELLIPSIS,
            SUPERPOSITION_GRID_LABEL_SPAN);
    });

let _cachedColLabelDrawer = new CachablePainting(
    numWire => {
        let [colWires, rowWires] = [Math.floor(numWire/2), Math.ceil(numWire/2)];
        let [colCount, rowCount] = [1 << colWires, 1 << rowWires];
        let total_height = (numWire - 1) * Layout.WIRE_SPACING + Layout.GATE_RADIUS * 2;
        let cellDiameter = total_height / rowCount;
        return {
            width: colCount * cellDiameter,
            height: SUPERPOSITION_GRID_LABEL_SPAN
        }
    },
    (painter, numWire) => {
        let [colWires, rowWires] = [Math.floor(numWire/2), Math.ceil(numWire/2)];
        let colCount = 1 << colWires;
        let dw = painter.paintableArea().w / colCount;

        painter.ctx.translate(colCount*dw, 0);
        painter.ctx.rotate(Math.PI/2);
        //noinspection JSCheckFunctionSignatures
        _drawLabelsReasonablyFast(
            painter,
            dw,
            colCount,
            // One ellipsis stands in for the bits the row supplies, keeping the label short enough to stay legible.
            i => SUPERPOSITION_GRID_LABEL_ELLIPSIS + Util.bin(colCount-1-i, colWires),
            SUPERPOSITION_GRID_LABEL_SPAN);
    });

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 * @param {!Hand} hand
 * @param {!CircuitStats} stats
 * @param {!boolean=false} forTooltip
 * @param {!boolean} showWires
 * @param {undefined|!int} playheadStep The number of columns that have executed at the playhead.
 */
function paintCircuit(circuit, painter, hand, stats, forTooltip=false, showWires=true, playheadStep=undefined) {
    if (!forTooltip) {
        drawPlayheadBand(circuit, painter, playheadStep);
    }

    if (showWires) {
        drawWires(circuit, painter, !forTooltip, hand);
    }

    for (let col = 0; col < circuit.circuitDefinition.columns.length; col++) {
        drawColumn(circuit, painter, circuit.circuitDefinition.columns[col], col, hand, stats);
    }

    if (!forTooltip) {
        drawOutputDisplays(circuit, painter, stats, hand);
        drawHintLabels(circuit, painter, stats);
    }

    drawRowDragHighlight(circuit, painter);
}

/**
 * Marks the column the playhead is about to execute, behind the wires and gates so they stay
 * readable through it.
 *
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 * @param {undefined|!int} playheadStep
 */
function drawPlayheadBand(circuit, painter, playheadStep) {
    // Once every column has run there is no next column to mark.
    if (playheadStep === undefined ||
            playheadStep < 0 ||
            playheadStep >= circuit.circuitDefinition.columns.length) {
        return;
    }

    let rect = circuit.gateRect(0, playheadStep, 1, circuit.geometry().groundedWireCount()).paddedBy(3);
    painter.fillRect(rect, Palette.PLAYHEAD_BAND_COLOR);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 * @param {!boolean} showLabels
 * @param {!Hand} hand
 */
function drawWires(circuit, painter, showLabels, hand) {
    let drawnWireCount = Math.min(circuit.circuitDefinition.numWires, (circuit.geometry().extraWireStartIndex || Infinity) + 1);

    // Initial value labels
    if (showLabels) {
        for (let row = 0; row < drawnWireCount; row++) {
            let wireRect = circuit.wireRect(row);
            let y = wireRect.center().y;
            let v = circuit.circuitDefinition.customInitialValues.get(row);
            if (v === undefined) {
                v = '0';
            }
            let rect = wireInitialStateClickableRect(circuit, row);
            painter.noteTouchBlocker({rect, cursor: 'pointer'});
            // A quiet fill marks the ket as clickable before the pointer ever finds it.
            painter.fillRect(rect, Palette.QUIET_GATE_FILL_COLOR);
            if (circuit._highlightedSlot === undefined && hand.pos !== undefined && rect.containsPoint(hand.pos)) {
                painter.fillRect(rect, Palette.HIGHLIGHTED_GATE_FILL_COLOR);
            }
            painter.print(
                `|${v}⟩`, 26, y, 'right', 'middle', Palette.INK_COLOR,
                `14px ${Typography.DEFAULT_FONT_FAMILY}`, 22, Layout.WIRE_SPACING);
        }
    }

    // Wires (doubled-up for measured sections).
    painter.ctx.save();
    for (let row = 0; row < drawnWireCount; row++) {
        if (row === circuit.geometry().extraWireStartIndex) {
            painter.ctx.globalAlpha *= 0.5;
        }
        painter.trace(trace => {
            let wireRect = circuit.wireRect(row);
            let y = Math.round(wireRect.center().y - 0.5) + 0.5;
            let lastX = showLabels ? 28 : 5;
            // Wires terminate at the superposition display instead of running to the canvas's right edge.
            let wireEndX = showLabels ? circuit.geometry().rectForSuperpositionDisplay().x - 4 : Infinity;
            //noinspection ForLoopThatDoesntUseLoopVariableJS
            for (let col = 0;
                    showLabels ? lastX < wireEndX : col <= circuit.circuitDefinition.columns.length;
                    col++) {
                let x = Math.min(circuit.opRect(col).center().x, wireEndX);
                if (circuit.circuitDefinition.locIsMeasured(new Point(col, row))) {
                    // Measured wire.
                    trace.line(lastX, y-1, x, y-1);
                    trace.line(lastX, y+1, x, y+1);
                } else {
                    // Unmeasured wire.
                    trace.line(lastX, y, x, y);
                }
                lastX = x;
            }
        }).thenStroke(Palette.INK_COLOR);
    }
    painter.ctx.restore();

    // A faint stub under the last wire advertises that dragging a gate below the circuit adds a
    // qubit. While a drag is showing the real preview wire, the hint gets out of the way.
    if (showLabels &&
            circuit.geometry().extraWireStartIndex === undefined &&
            circuit.circuitDefinition.numWires < Simulation.MAX_WIRE_COUNT) {
        let hintY = Math.round(circuit.wireRect(drawnWireCount).center().y - 0.5) + 0.5;
        painter.ctx.save();
        painter.ctx.setLineDash([4, 4]);
        painter.strokeLine(new Point(28, hintY), new Point(150, hintY), Palette.FAINT_LINE_COLOR);
        painter.ctx.restore();
        painter.print(
            '+', 26, hintY, 'right', 'middle', Palette.FAINT_LINE_COLOR,
            `14px ${Typography.DEFAULT_FONT_FAMILY}`, 22, Layout.WIRE_SPACING);
    }

    if (circuit.geometry().extraWireStartIndex !== undefined && circuit.circuitDefinition.numWires === Simulation.MAX_WIRE_COUNT) {
        painter.print(
            `(Max wires. Qubit limit is ${Simulation.MAX_WIRE_COUNT}.)`,
            5,
            circuit.wireRect(Simulation.MAX_WIRE_COUNT).y,
            'left',
            'top',
            Palette.ERROR_COLOR,
            `bold 16px ${Typography.MONO_FONT_FAMILY}`,
            400,
            Layout.WIRE_SPACING);
    }
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 * @param {!int} col
 * @param {!int} row
 * @param {!Rect} gateRect
 * @param {!boolean} isHighlighted
 */
function drawGate_disabledReason(circuit, painter, col, row, gateRect, isHighlighted) {
    let isDisabledReason = circuit.circuitDefinition.gateAtLocIsDisabledReason(col, row);
    if (isDisabledReason === undefined) {
        return;
    }

    painter.ctx.save();
    if (isHighlighted) {
        painter.ctx.globalAlpha *= 0.3;
    }
    painter.ctx.globalAlpha *= 0.5;
    painter.fillRect(gateRect.paddedBy(5), Palette.HIGHLIGHT_FILL_COLOR);
    painter.ctx.globalAlpha *= 2;
    painter.strokeLine(gateRect.topLeft(), gateRect.bottomRight(), Palette.HIGHLIGHT_STROKE_COLOR, 3);
    let r = painter.printParagraph(isDisabledReason, gateRect.paddedBy(5), new Point(0.5, 0.5), Palette.ERROR_COLOR);
    painter.ctx.globalAlpha *= 0.5;
    painter.fillRect(r.paddedBy(2), Palette.HIGHLIGHT_FILL_COLOR);
    painter.ctx.globalAlpha *= 2;
    painter.printParagraph(isDisabledReason, gateRect.paddedBy(5), new Point(0.5, 0.5), Palette.ERROR_COLOR);
    painter.ctx.restore()
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 * @param {!GateColumn} gateColumn
 * @param {!int} col
 * @param {!Hand} hand
 * @param {!CircuitStats} stats
 */
function drawColumn(circuit, painter, gateColumn, col, hand, stats) {
    drawColumnControlWires(circuit, painter, col);
    drawColumnDragHighlight(circuit, painter, col);

    for (let row = 0; row < circuit.circuitDefinition.numWires; row++) {
        if (gateColumn.gates[row] === undefined) {
            continue;
        }
        let gate = gateColumn.gates[row];
        let gateRect = circuit.gateRect(row, col, gate.width, gate.height);

        let {isHighlighted, isResizeShowing, isResizeHighlighted} =
            circuit._highlightStatusAt(col, row, hand.hoverPoints());

        let drawer = gate.customDrawer || GatePainting.DEFAULT_DRAWER;
        painter.noteTouchBlocker({rect: gateRect, cursor: 'pointer'});
        if (gate.canChangeInSize()) {
            painter.noteTouchBlocker({rect: GatePainting.rectForResizeTab(gateRect), cursor: 'ns-resize'});
        }
        drawer(GateDrawParams.inCircuit(painter, hand, gateRect, gate, stats, {row, col}, {
            isHighlighted: isHighlighted && !isResizeHighlighted,
            isResizeShowing,
            isResizeHighlighted,
            focusPoints: circuit._highlightedSlot === undefined ? hand.hoverPoints() : [],
            customStats: stats.customStatsForSlot(col, row)}));

        drawGate_disabledReason(circuit, painter, col, row, gateRect, isHighlighted);
    }

    drawColumnSurvivalRate(circuit, painter, gateColumn, col, stats);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 * @param {!GateColumn} gateColumn
 * @param {!int} col
 * @param {!CircuitStats} stats
 */
function drawColumnSurvivalRate(circuit, painter, gateColumn, col, stats) {
    if (gateColumn.indexOfNonUnitaryGate() === undefined) {
        return;
    }

    let preRate = stats.survivalRate(col - 1);
    let postRate = stats.survivalRate(col);

    let marginalRate = (postRate - preRate) / preRate;
    if (isNaN(marginalRate) || Math.abs(marginalRate) <= 0.005) {
        return;
    }

    let descAmount;
    let descCategory;
    if (marginalRate < 0) {
        let rate = Math.round(-marginalRate * 100);
        let rateDesc = marginalRate === -1 ? "100" : rate < 100 ? rate : ">99";
        descAmount = `${rateDesc}%`;
        descCategory = 'omits';
    } else {
        let factor = Math.round(marginalRate * 100 + 100);
        descAmount = `${factor}%`;
        descCategory = 'gains';
    }

    let pt = circuit.opRect(col).bottomCenter();
    painter.print(
        descCategory,
        pt.x,
        pt.y - 28,
        'center',
        'bottom',
        Palette.ERROR_COLOR,
        `14px ${Typography.DEFAULT_FONT_FAMILY}`,
        800,
        50);
    painter.print(
        descAmount,
        pt.x,
        pt.y - 13,
        'center',
        'bottom',
        Palette.ERROR_COLOR,
        `14px ${Typography.DEFAULT_FONT_FAMILY}`,
        800,
        50);
}

function drawColumnDragHighlight(circuit, painter, col) {
    if (circuit._highlightedSlot !== undefined &&
        circuit._highlightedSlot.col === col &&
        circuit._highlightedSlot.row === undefined) {
        let rect = circuit.gateRect(0, col, 1, circuit.geometry().groundedWireCount()).paddedBy(3);
        painter.fillRect(rect, Palette.DROP_TARGET_FILL_COLOR);
        painter.strokeRect(rect, Palette.INK_COLOR);
    }
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 */
function drawRowDragHighlight(circuit, painter) {
    if (circuit._highlightedSlot !== undefined &&
            circuit._highlightedSlot.col === undefined &&
            circuit._highlightedSlot.row !== undefined) {

        let row = circuit._highlightedSlot.row;
        let w = circuit.gateRect(row, circuit.clampedCircuitColCount() + 1).x;
        let rect = circuit.wireRect(row).takeLeft(w);
        painter.fillRect(rect, Palette.DROP_TARGET_FILL_COLOR);
        painter.strokeRect(rect, Palette.INK_COLOR);
    }
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 * @param {!int} columnIndex
 */
function drawColumnControlWires(circuit, painter, columnIndex) {
    let x = Math.round(circuit.opRect(columnIndex).center().x - 0.5) + 0.5;

    // Dashed line indicates effects from non-unitary gates may affect, or appear to affect, other wires.
    if (circuit.circuitDefinition.columns[columnIndex].hasGatesWithGlobalEffects()) {
        painter.ctx.save();
        painter.ctx.setLineDash([1, 4]);
        painter.strokeLine(
            new Point(x, circuit.gateRect(0, 0).y),
            new Point(x, circuit.opRect(0).bottom() - 40));
        painter.ctx.restore();
    }

    for (let {first, last, measured} of circuit.circuitDefinition.controlLinesRanges(columnIndex)) {
        let y1 =  circuit.wireRect(first).center().y;
        let y2 = circuit.wireRect(last).center().y;
        if (measured) {
            painter.strokeLine(new Point(x+1, y1), new Point(x+1, y2));
            painter.strokeLine(new Point(x-1, y1), new Point(x-1, y2));
        } else {
            painter.strokeLine(new Point(x, y1), new Point(x, y2));
        }
    }
}

/**
 * Draws a peek gate on each wire at the right-hand side of the circuit.
 *
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 * @param {!CircuitStats} stats
 * @param {!Hand} hand
 */
function drawOutputDisplays(circuit, painter, stats, hand) {
    let chanceCol = circuit.clampedCircuitColCount() + 1;
    let blochCol = chanceCol + 1;
    let numWire = circuit.importantWireCount();

    for (let i = 0; i < numWire; i++) {
        let p = stats.controlledWireProbabilityJustAfter(i, Infinity);
        MathPainter.paintProbabilityBox(painter, p, circuit.gateRect(i, chanceCol), hand.hoverPoints());
        let m = stats.qubitDensityMatrix(Infinity, i);
        if (m !== undefined) {
            paintBlochSphereDisplay(painter, m, circuit.gateRect(i, blochCol), hand.hoverPoints());
        }
    }

    let bottom = circuit.wireRect(numWire-1).bottom();
    let capX = circuit.opRect(chanceCol).x - 35;
    // Keep the caption clear of the superposition grid's rotated column labels.
    let capW = Math.min(160, circuit.geometry().rectForSuperpositionDisplay().x - capX - 10);
    painter.printParagraph(
        "Local wire states\n(Chance/Bloch)",
        new Rect(capX, bottom + 8, capW, 40),
        new Point(0.5, 0),
        Palette.MUTED_TEXT_COLOR);

    drawOutputSuperpositionDisplay(circuit, painter, stats, hand);
}

/**
 * Draws a peek gate on each wire at the right-hand side of the circuit.
 *
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 * @param {!CircuitStats} stats
 * @param {!Hand} hand
 */
function drawOutputSuperpositionDisplay(circuit, painter, stats, hand) {
    let amplitudeGrid = circuit._outputStateAsMatrix(stats);
    let gridRect = circuit.geometry().rectForSuperpositionDisplay();

    let numWire = circuit.importantWireCount();
    MathPainter.paintMatrix(
        painter,
        amplitudeGrid,
        gridRect,
        numWire < Simulation.SIMPLE_SUPERPOSITION_DRAWING_WIRE_THRESHOLD ? Palette.SUPERPOSITION_MID_COLOR : undefined,
        Palette.INK_COLOR,
        numWire < Simulation.SIMPLE_SUPERPOSITION_DRAWING_WIRE_THRESHOLD ? Palette.SUPERPOSITION_FORE_COLOR : undefined,
        Palette.SUPERPOSITION_BACK_COLOR);
    let forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    MathPainter.paintMatrixTooltip(painter, amplitudeGrid, gridRect, hand.hoverPoints(),
        (c, r) => `Amplitude of |${Util.bin(r*amplitudeGrid.width() + c, numWire)}⟩ (decimal ${r*amplitudeGrid.width() + c})`,
        (c, r, v) => 'val:' + v.toString(new Format(false, 0, 5, ", ")),
        (c, r, v) => `mag²:${(v.norm2()*100).toFixed(4)}%, phase:${forceSign(v.phase() * 180 / Math.PI)}°`);

    drawOutputSuperpositionDisplay_labels(circuit, painter);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 */
function drawOutputSuperpositionDisplay_labels(circuit, painter) {
    let gridRect = circuit.geometry().rectForSuperpositionDisplay();
    let numWire = circuit.importantWireCount();
    _cachedRowLabelDrawer.paint(gridRect.right(), gridRect.y, painter, numWire);
    _cachedColLabelDrawer.paint(gridRect.x, gridRect.bottom(), painter, numWire);
}

/**
 * Draws a peek gate on each wire at the right-hand side of the circuit.
 *
 * @param {!DisplayedCircuit} circuit
 * @param {!Painter} painter
 * @param {!CircuitStats} stats
 */
function drawHintLabels(circuit, painter, stats) {
    let gridRect = circuit.geometry().rectForSuperpositionDisplay();

    // Amplitude hint.
    painter.print(
        'Final amplitudes',
        gridRect.right() + DISPLAY_CAPTION_GAP,
        gridRect.bottom() + 3,
        'left',
        'top',
        Palette.MUTED_TEXT_COLOR,
        `12px ${Typography.DEFAULT_FONT_FAMILY}`,
        DISPLAY_CAPTION_WIDTH,
        20);

    // Says what each cell's glyphs encode, which is otherwise only discoverable by hovering.
    painter.printParagraph(
        "area = chance\nline = phase",
        new Rect(gridRect.right() + DISPLAY_CAPTION_GAP, gridRect.bottom() + 18, DISPLAY_CAPTION_WIDTH, 26),
        new Point(0, 0),
        Palette.MUTED_TEXT_COLOR,
        10);

    // Deferred measurement warning.
    if (circuit.circuitDefinition.colIsMeasuredMask(Infinity) !== 0) {
        painter.printParagraph(
            "(assuming measurement deferred)",
            new Rect(
                gridRect.right() + DISPLAY_CAPTION_GAP,
                gridRect.bottom() + 48,
                DISPLAY_CAPTION_WIDTH,
                DISPLAY_WARNING_STRIP_HEIGHT),
            new Point(0.5, 0),
            Palette.ERROR_COLOR);
    }

    // Discard rate warning.
    let survivalRate = stats.survivalRate(Infinity);
    if (Math.abs(survivalRate - 1) > 0.01) {
        let desc;
        if (survivalRate < 1) {
            let rate = Math.round(survivalRate * 100);
            let rateDesc = survivalRate === 0 ? "0" :
                rate > 0 ? rate :
                "<1";
            desc = `kept: ${rateDesc}%`;
        } else {
            let factor = Math.round(survivalRate * 100);
            desc = `over-unity: ${factor}%`;
        }
        painter.print(
            desc,
            circuit.geometry().rectForSuperpositionDisplay().x - 5,
            gridRect.bottom() + SUPERPOSITION_GRID_LABEL_SPAN + 20,
            'right',
            'bottom',
            Palette.ERROR_COLOR,
            `14px ${Typography.DEFAULT_FONT_FAMILY}`,
            800,
            50);
    }
}

export {paintCircuit}
