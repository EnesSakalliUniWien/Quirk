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

import {PathGeometry} from '../draw/pixi/PathGeometry.js';
import {drawPath, rectangle, strokePath} from '../draw/pixi/ShapeView.js';

import {measureText, drawText, fitText, fitParagraph} from '../draw/pixi/TextLayout.js';
import {drawingArea} from '../draw/pixi/DisplayView.js';

/** @typedef {import('../draw/pixi/DisplayView.js').DisplayView} DisplayView */

import {wireInitialStateClickableRect} from './CircuitHitTesting.js';
import {renderGateView} from '../draw/pixi/GateView.js';
import {BasisLabels} from '../draw/pixi/BasisLabels.js';

import {Layout} from '../config/Layout.js';
import {CanvasTheme, phaseColor} from '../config/CanvasTheme.js';
import {Simulation} from '../config/Simulation.js';
import {Typography} from '../config/Typography.js';
import {Format} from '../base/Format.js';

import {GateDrawParams} from '../draw/gate/GateDrawParams.js';
import {GatePainting} from '../draw/gate/GatePainting.js';

import {MathPainter} from '../draw/MathPainter.js';
import {Point} from '../geometry/Point.js';
import {Rect} from '../geometry/Rect.js';
import {Util} from '../base/Util.js';
import {CircuitGeometry} from './CircuitGeometry.js';
import {rectForResizeTab} from '../draw/gate/GateRects.js';
import {paintBlochSphereDisplay} from '../gates/displays/BlochSphereDisplay.js';
import {SUPERPOSITION_GRID_LABEL_SPAN, DISPLAY_CAPTION_WIDTH, DISPLAY_CAPTION_GAP, DISPLAY_WARNING_STRIP_HEIGHT} from './CircuitLayoutConstants.js';

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
 * @param {!DisplayView} painter
 * @param {!number} dy
 * @param {!int} n
 * @param {!function(!int) : !String} labeller
 * @param {!number} boundingWidth
 * @private
 */
function _drawLabelsReasonablyFast(painter, dy, n, labeller, boundingWidth) {
    painter.group('basis-text-' + painter.order, painter => {
        const font = {
            fontSize: 12,
            fontFamily: Typography.MONO_FONT_FAMILY
        };
        const w = Math.max(measureText(labeller(0), font).width, measureText(labeller(n - 1), font).width);
        const h = measureText("0", font).width * 2.5;
        const scale = Math.min(Math.min((boundingWidth - 2) / w, dy / h), 1);

        // Row labels.
        const step = dy / scale;
        const pad = 1 / scale;
        painter.scale.set(scale, scale);
        painter.position.set(0, dy * 0.5 - scale * h * 0.5);
        if (h < step * 0.95) {
            for (let i = 0; i < n; i++) {
                rectangle(painter, new Rect(0, step * i, w + 2 * pad, h), {
                    fill: CanvasTheme.surface.gate
                });
            }
        } else {
            rectangle(painter, new Rect(0, 0, w + 2 * pad, step * n), {
                fill: CanvasTheme.surface.gate
            });
        }
        for (let i = 0; i < n; i++) {
            drawText(painter, labeller(i), {
                x: pad,
                y: h * 0.5 + step * i,
                fill: CanvasTheme.text.primary,
                font,
                align: 'left',
                baseline: 'middle'
            });
        }
    });
}

const _cachedRowLabelDrawer = new BasisLabels(
    numWire => ({
        width: SUPERPOSITION_GRID_LABEL_SPAN,
        height: (numWire - 1) * Layout.WIRE_SPACING + Layout.GATE_RADIUS * 2
    }),
    (painter, numWire) => {
        const rowWires = Math.ceil(numWire/2);
        const rowCount = 1 << rowWires;
        _drawLabelsReasonablyFast(
            painter,
            drawingArea(painter).h / rowCount,
            rowCount,
            // One ellipsis stands in for the bits the column supplies, keeping the label short enough to stay legible.
            i => Util.bin(i, rowWires) + SUPERPOSITION_GRID_LABEL_ELLIPSIS,
            SUPERPOSITION_GRID_LABEL_SPAN);
    });

const _cachedColLabelDrawer = new BasisLabels(
    numWire => {
        const [colWires, rowWires] = [Math.floor(numWire/2), Math.ceil(numWire/2)];
        const [colCount, rowCount] = [1 << colWires, 1 << rowWires];
        const total_height = (numWire - 1) * Layout.WIRE_SPACING + Layout.GATE_RADIUS * 2;
        const cellDiameter = total_height / rowCount;
        return {
            width: colCount * cellDiameter,
            height: SUPERPOSITION_GRID_LABEL_SPAN
        }
    },
    (painter, numWire) => {
        const colWires = Math.floor(numWire/2);
        const colCount = 1 << colWires;
        const dw = drawingArea(painter).w / colCount;

        painter.position.set(colCount*dw, 0);
        painter.rotation = Math.PI/2;
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
 * @param {!DisplayView} painter
 * @param {!Hand} hand
 * @param {!CircuitStats} stats
 * @param {!boolean=false} forTooltip
 * @param {!boolean} showWires
 * @param {undefined|!int} playheadStep The number of columns that have executed at the playhead.
 */
function paintCircuit(circuit, painter, hand, stats, forTooltip=false, showWires=true, playheadStep=undefined) {
    if (!forTooltip) {
        painter.group('playhead', view => drawPlayheadBand(circuit, view, playheadStep));
    }

    if (showWires) {
        painter.group('wires', view => drawWires(circuit, view, !forTooltip, hand));
    }

    for (let col = 0; col < circuit.circuitDefinition.columns.length; col++) {
        painter.group(`column-${col}`, view => drawColumn(circuit, view, circuit.circuitDefinition.columns[col], col, hand, stats));
    }

    if (!forTooltip) {
        painter.group('outputs', view => drawOutputDisplays(circuit, view, stats, hand));
        painter.group('hints', view => drawHintLabels(circuit, view, stats));
    }

    painter.group('row-highlight', view => drawRowDragHighlight(circuit, view));
}

/**
 * Marks the column the playhead is about to execute, behind the wires and gates so they stay
 * readable through it.
 *
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
 * @param {undefined|!int} playheadStep
 */
function drawPlayheadBand(circuit, painter, playheadStep) {
    // Once every column has run there is no next column to mark.
    if (playheadStep === undefined ||
            playheadStep < 0 ||
            playheadStep >= circuit.circuitDefinition.columns.length) {
        return;
    }

    const rect = circuit.gateRect(0, playheadStep, 1, circuit.geometry().groundedWireCount()).paddedBy(3);
    rectangle(painter, rect, {fill: CanvasTheme.interaction.playheadBand});
    strokePath(painter, [rect.topLeft(), rect.bottomLeft()], CanvasTheme.interaction.playhead, 2);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
 * @param {!boolean} showLabels
 * @param {!Hand} hand
 */
function drawWires(circuit, painter, showLabels, hand) {
    const drawnWireCount = Math.min(circuit.circuitDefinition.numWires, (circuit.geometry().extraWireStartIndex || Infinity) + 1);

    // Initial value labels
    if (showLabels) {
        for (let row = 0; row < drawnWireCount; row++) {
            const wireRect = circuit.wireRect(row);
            const y = wireRect.center().y;
            let v = circuit.circuitDefinition.customInitialValues.get(row);
            if (v === undefined) {
                v = '0';
            }
            const rect = wireInitialStateClickableRect(circuit, row);
            const indexRect = circuit.geometry().wireIndexRect(row);
            fitText(painter, `q${row}`, {
                x: indexRect.x,
                y,
                align: 'left',
                baseline: 'middle',
                fill: CanvasTheme.text.muted,
                font: {fontSize: Layout.REGISTER_FONT_SIZE, fontFamily: Typography.MONO_FONT_FAMILY},
                width: indexRect.w,
                height: indexRect.h
            });
            painter.interaction.block({rect, cursor: 'pointer'});
            // A quiet fill marks the ket as clickable before the pointer ever finds it.
            rectangle(painter, rect, {fill: CanvasTheme.surface.quiet});
            if (circuit._highlightedSlot === undefined && hand.pos !== undefined && rect.containsPoint(hand.pos)) {
                rectangle(painter, rect, {fill: CanvasTheme.gate.hover});
            }
            fitText(painter, `|${v}⟩`, {
                x: rect.center().x,
                y,
                align: 'center',
                baseline: 'middle',
                fill: CanvasTheme.text.primary,
                font: {fontSize: Layout.REGISTER_FONT_SIZE, fontFamily: Typography.DEFAULT_FONT_FAMILY},
                width: rect.w - Layout.REGISTER_MARGIN,
                height: rect.h
            });
        }
    }

    // Wires (doubled-up for measured sections).
    for (let row = 0; row < drawnWireCount; row++) {
        painter.group('wire-' + row, painter => {
            painter.alpha = row >= circuit.geometry().extraWireStartIndex ? 0.5 : 1;
            const segments = [[], []];
            const wireRect = circuit.wireRect(row);
            const y = Math.round(wireRect.center().y - 0.5) + 0.5;
            let lastX = showLabels ? circuit.geometry().wireInitialStateRect(row).right() : 5;
            // Wires terminate at the superposition display instead of running to the canvas's right edge.
            const wireEndX = showLabels ? circuit.geometry().rectForSuperpositionDisplay().x - 4 : Infinity;
            for (let col = 0; showLabels ? lastX < wireEndX : col <= circuit.circuitDefinition.columns.length; col++) {
                const x = Math.min(circuit.opRect(col).center().x, wireEndX);
                if (circuit.circuitDefinition.locIsMeasured(new Point(col, row))) {
                    // Measured wire.
                    segments[1].push([lastX, y - 1, x, y - 1]);
                    segments[1].push([lastX, y + 1, x, y + 1]);
                } else {
                    // Unmeasured wire.
                    segments[0].push([lastX, y, x, y]);
                }
                lastX = x;
            }
            for (const [i, color] of [CanvasTheme.text.primary, CanvasTheme.iqp.classicalWire].entries()) {
                drawPath(painter, trace => segments[i].forEach(segment => PathGeometry.line(trace, ...segment)), [{
                    stroke: {
                        color: color,
                        width: 1
                    }
                }]);
            }
        });
    }

    // A faint stub under the last wire advertises that dragging a gate below the circuit adds a
    // qubit. While a drag is showing the real preview wire, the hint gets out of the way.
    if (showLabels &&
            circuit.geometry().extraWireStartIndex === undefined &&
            circuit.circuitDefinition.numWires < Simulation.MAX_WIRE_COUNT) {
        const hintY = Math.round(circuit.wireRect(drawnWireCount).center().y - 0.5) + 0.5;
        const hintRect = circuit.geometry().wireInitialStateRect(drawnWireCount);
        painter.group('wire-hint-' + painter.order, painter => {
            strokePath(painter, [new Point(hintRect.right(), hintY), new Point(circuit.opRect(1).right(), hintY)], CanvasTheme.stroke.faint, 1, [4, 4]);
        });
        fitText(painter, '+', {
            x: hintRect.center().x,
            y: hintY,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.stroke.faint,
            font: {fontSize: Layout.REGISTER_FONT_SIZE, fontFamily: Typography.DEFAULT_FONT_FAMILY},
            width: hintRect.w,
            height: hintRect.h
        });
    }

    if (circuit.geometry().extraWireStartIndex !== undefined && circuit.circuitDefinition.numWires === Simulation.MAX_WIRE_COUNT) {
        fitText(painter, `(Max wires. Qubit limit is ${Simulation.MAX_WIRE_COUNT}.)`, {
            x: 5,
            y: circuit.wireRect(Simulation.MAX_WIRE_COUNT).y,
            align: 'left',
            baseline: 'top',
            fill: CanvasTheme.error.text,
            font: {fontSize: 16, fontFamily: Typography.MONO_FONT_FAMILY, fontWeight: 'bold'},
            width: 400,
            height: Layout.WIRE_SPACING
        });
    }
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
 * @param {!int} col
 * @param {!int} row
 * @param {!Rect} gateRect
 * @param {!boolean} isHighlighted
 */
function drawGate_disabledReason(circuit, painter, col, row, gateRect, isHighlighted) {
    const isDisabledReason = circuit.circuitDefinition.gateAtLocIsDisabledReason(col, row);
    if (isDisabledReason === undefined) {
        return;
    }

    // Keep the reason opaque and readable, including while the disabled gate is hovered.
    strokePath(painter, [gateRect.topLeft(), gateRect.bottomRight()], CanvasTheme.error.text, 3);
    const area = gateRect.paddedBy(5);
    rectangle(painter, area, {fill: CanvasTheme.error.background});
    rectangle(painter, area, {stroke: {color: CanvasTheme.error.text, width: 1}});
    strokePath(painter, [area.topLeft(), area.bottomRight()], CanvasTheme.error.text, 2);
    const textArea = fitParagraph(painter, isDisabledReason, area, {
        alignment: new Point(0.5, 0.5),
        fill: CanvasTheme.error.text
    });
    rectangle(painter, textArea.paddedBy(2), {fill: CanvasTheme.error.background});
    fitParagraph(painter, isDisabledReason, area, {
        alignment: new Point(0.5, 0.5),
        fill: CanvasTheme.error.text
    });
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
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
        const gate = gateColumn.gates[row];
        const gateRect = circuit.geometry().gateDrawRect(row, col, gate);

        const {isHighlighted, isResizeShowing, isResizeHighlighted} =
            circuit._highlightStatusAt(col, row, hand.hoverPoints());

        const drawer = gate.customDrawer || GatePainting.DEFAULT_DRAWER;
        painter.interaction.block({rect: gateRect, cursor: 'pointer'});
        if (gate.canChangeInSize()) {
            painter.interaction.block({rect: rectForResizeTab(gateRect), cursor: 'ns-resize'});
        }
        renderGateView(painter, `gate-${col}-${row}`, GateDrawParams.inCircuit(painter, hand, gateRect, gate, stats, {row, col}, {
            isHighlighted: isHighlighted && !isResizeHighlighted,
            isResizeShowing,
            isResizeHighlighted,
            focusPoints: circuit._highlightedSlot === undefined ? hand.hoverPoints() : [],
            customStats: stats.customStatsForSlot(col, row)}), drawer);

        drawGate_disabledReason(circuit, painter, col, row, gateRect, isHighlighted);
    }

    drawColumnSurvivalRate(circuit, painter, gateColumn, col, stats);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
 * @param {!GateColumn} gateColumn
 * @param {!int} col
 * @param {!CircuitStats} stats
 */
function drawColumnSurvivalRate(circuit, painter, gateColumn, col, stats) {
    if (gateColumn.indexOfNonUnitaryGate() === undefined) {
        return;
    }

    const preRate = stats.survivalRate(col - 1);
    const postRate = stats.survivalRate(col);

    const marginalRate = (postRate - preRate) / preRate;
    if (Number.isNaN(marginalRate) || Math.abs(marginalRate) <= 0.005) {
        return;
    }

    let descAmount;
    let descCategory;
    if (marginalRate < 0) {
        const rate = Math.round(-marginalRate * 100);
        const rateDesc = marginalRate === -1 ? "100" : rate < 100 ? rate : ">99";
        descAmount = `${rateDesc}%`;
        descCategory = 'omits';
    } else {
        const factor = Math.round(marginalRate * 100 + 100);
        descAmount = `${factor}%`;
        descCategory = 'gains';
    }

    const pt = circuit.opRect(col).bottomCenter();
    fitText(painter, descCategory, {
        x: pt.x,
        y: pt.y - 28,
        align: 'center',
        baseline: 'bottom',
        fill: CanvasTheme.error.text,
        font: {fontSize: 14, fontFamily: Typography.DEFAULT_FONT_FAMILY},
        width: 800,
        height: 50
    });
    fitText(painter, descAmount, {
        x: pt.x,
        y: pt.y - 13,
        align: 'center',
        baseline: 'bottom',
        fill: CanvasTheme.error.text,
        font: {fontSize: 14, fontFamily: Typography.DEFAULT_FONT_FAMILY},
        width: 800,
        height: 50
    });
}

function drawColumnDragHighlight(circuit, painter, col) {
    if (circuit._highlightedSlot !== undefined &&
        circuit._highlightedSlot.col === col &&
        circuit._highlightedSlot.row === undefined) {
        const rect = circuit.gateRect(0, col, 1, circuit.geometry().groundedWireCount()).paddedBy(3);
        rectangle(painter, rect, {fill: CanvasTheme.interaction.drop});
        rectangle(painter, rect, {stroke: {color: CanvasTheme.text.primary, width: 1}});
    }
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
 */
function drawRowDragHighlight(circuit, painter) {
    if (circuit._highlightedSlot !== undefined &&
            circuit._highlightedSlot.col === undefined &&
            circuit._highlightedSlot.row !== undefined) {

        const row = circuit._highlightedSlot.row;
        const w = circuit.gateRect(row, circuit.clampedCircuitColCount() + 1).x;
        const rect = circuit.wireRect(row).takeLeft(w);
        rectangle(painter, rect, {fill: CanvasTheme.interaction.drop});
        rectangle(painter, rect, {stroke: {color: CanvasTheme.text.primary, width: 1}});
    }
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
 * @param {!int} columnIndex
 */
function drawColumnControlWires(circuit, painter, columnIndex) {
    const x = Math.round(circuit.opRect(columnIndex).center().x - 0.5) + 0.5;

    // Dashed line indicates effects from non-unitary gates may affect, or appear to affect, other wires.
    if (circuit.circuitDefinition.columns[columnIndex].hasGatesWithGlobalEffects()) {
        painter.group('global-control-' + painter.order, painter => {
            strokePath(painter, [new Point(x, circuit.gateRect(0, 0).y), new Point(x, circuit.opRect(0).bottom() - 40)], CanvasTheme.text.primary, 1, [1, 4]);
        });
    }

    for (const {first, last, measured} of circuit.circuitDefinition.controlLinesRanges(columnIndex)) {
        const y1 =  circuit.wireRect(first).center().y;
        const y2 = circuit.wireRect(last).center().y;
        if (measured) {
            strokePath(painter, [new Point(x+1, y1), new Point(x+1, y2)], CanvasTheme.iqp.classicalWire, 1);
            strokePath(painter, [new Point(x-1, y1), new Point(x-1, y2)], CanvasTheme.iqp.classicalWire, 1);
        } else {
            strokePath(painter, [new Point(x, y1), new Point(x, y2)], CanvasTheme.text.primary, 1);
        }
    }
}

/**
 * Draws a peek gate on each wire at the right-hand side of the circuit.
 *
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
 * @param {!CircuitStats} stats
 * @param {!Hand} hand
 */
function drawOutputDisplays(circuit, painter, stats, hand) {
    const chanceCol = circuit.clampedCircuitColCount() + 1;
    const blochCol = chanceCol + 1;
    const numWire = circuit.importantWireCount();

    for (let i = 0; i < numWire; i++) {
        const p = stats.controlledWireProbabilityJustAfter(i, Infinity);
        painter.group('probability-' + i, view => MathPainter.paintProbabilityBox(view, p, circuit.gateRect(i, chanceCol), hand.hoverPoints()));
        const m = stats.qubitDensityMatrix(Infinity, i);
        if (m !== undefined) {
            const blochRect = CircuitGeometry.blochDisplayRect(circuit.gateRect(i, blochCol));
            painter.group('bloch-' + i, view => paintBlochSphereDisplay(view, m, blochRect, hand.hoverPoints()));
            // Clicking a sphere opens the enlarged Bloch view; the cursor is the affordance.
            if (hand.hoverPoints().some(pt => blochRect.containsPoint(pt))) {
                painter.interaction.cursor = 'pointer';
            }
        }
    }

    const bottom = circuit.wireRect(numWire-1).bottom();
    const capX = circuit.opRect(chanceCol).x - 35;
    // Keep the caption clear of the superposition grid's rotated column labels.
    const capW = Math.min(160, circuit.geometry().rectForSuperpositionDisplay().x - capX - 10);
    fitParagraph(painter, "Local wire states\n(Chance/Bloch)", new Rect(capX, bottom + 8, capW, 40), {
        alignment: new Point(0.5, 0),
        fill: CanvasTheme.text.muted
    });

    painter.group('amplitudes', view => drawOutputSuperpositionDisplay(circuit, view, stats, hand));
}

/**
 * Draws a peek gate on each wire at the right-hand side of the circuit.
 *
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
 * @param {!CircuitStats} stats
 * @param {!Hand} hand
 */
function drawOutputSuperpositionDisplay(circuit, painter, stats, hand) {
    const amplitudeGrid = circuit._outputStateAsMatrix(stats);
    const gridRect = circuit.geometry().rectForSuperpositionDisplay();

    const numWire = circuit.importantWireCount();
    MathPainter.paintMatrix(
        painter,
        amplitudeGrid,
        gridRect,
        numWire < Simulation.SIMPLE_SUPERPOSITION_DRAWING_WIRE_THRESHOLD ? CanvasTheme.amplitude.circle : undefined,
        CanvasTheme.text.primary,
        numWire < Simulation.SIMPLE_SUPERPOSITION_DRAWING_WIRE_THRESHOLD ? CanvasTheme.amplitude.fill : undefined,
        CanvasTheme.amplitude.background,
        numWire < Simulation.SIMPLE_SUPERPOSITION_DRAWING_WIRE_THRESHOLD ? phaseColor : undefined);
    const forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    MathPainter.paintMatrixTooltip(painter, amplitudeGrid, gridRect, hand.hoverPoints(),
        (c, r) => `Amplitude of |${Util.bin(r*amplitudeGrid.width() + c, numWire)}⟩ (decimal ${r*amplitudeGrid.width() + c})`,
        (c, r, v) => 'val:' + v.toString(new Format(false, 0, 5, ", ")),
        (c, r, v) => `mag²:${(v.norm2()*100).toFixed(4)}%, phase:${forceSign(v.phase() * 180 / Math.PI)}°`);

    drawOutputSuperpositionDisplay_labels(circuit, painter);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
 */
function drawOutputSuperpositionDisplay_labels(circuit, painter) {
    const gridRect = circuit.geometry().rectForSuperpositionDisplay();
    const numWire = circuit.importantWireCount();
    _cachedRowLabelDrawer.paint(gridRect.right(), gridRect.y, painter, numWire);
    _cachedColLabelDrawer.paint(gridRect.x, gridRect.bottom(), painter, numWire);
}

/**
 * Draws a peek gate on each wire at the right-hand side of the circuit.
 *
 * @param {!DisplayedCircuit} circuit
 * @param {!DisplayView} painter
 * @param {!CircuitStats} stats
 */
function drawHintLabels(circuit, painter, stats) {
    const gridRect = circuit.geometry().rectForSuperpositionDisplay();

    // Amplitude hint.
    fitText(painter, 'Final amplitudes', {
        x: gridRect.right() + DISPLAY_CAPTION_GAP,
        y: gridRect.bottom() + 3,
        align: 'left',
        baseline: 'top',
        fill: CanvasTheme.text.muted,
        font: {fontSize: 12, fontFamily: Typography.DEFAULT_FONT_FAMILY},
        width: DISPLAY_CAPTION_WIDTH,
        height: 20
    });

    // Says what each cell's glyphs encode, which is otherwise only discoverable by hovering.
    fitParagraph(painter, "area = chance\nline = phase", new Rect(gridRect.right() + DISPLAY_CAPTION_GAP, gridRect.bottom() + 18, DISPLAY_CAPTION_WIDTH, 26), {
        alignment: new Point(0, 0),
        fill: CanvasTheme.text.muted,
        maxFontSize: 10
    });

    // Deferred measurement warning.
    if (circuit.circuitDefinition.colIsMeasuredMask(Infinity) !== 0) {
        fitParagraph(painter, "(assuming measurement deferred)", new Rect(
                gridRect.right() + DISPLAY_CAPTION_GAP,
                gridRect.bottom() + 48,
                DISPLAY_CAPTION_WIDTH,
                DISPLAY_WARNING_STRIP_HEIGHT), {
            alignment: new Point(0.5, 0),
            fill: CanvasTheme.error.text
        });
    }

    // Discard rate warning.
    const survivalRate = stats.survivalRate(Infinity);
    if (Math.abs(survivalRate - 1) > 0.01) {
        let desc;
        if (survivalRate < 1) {
            const rate = Math.round(survivalRate * 100);
            const rateDesc = survivalRate === 0 ? "0" :
                rate > 0 ? rate :
                "<1";
            desc = `kept: ${rateDesc}%`;
        } else {
            const factor = Math.round(survivalRate * 100);
            desc = `over-unity: ${factor}%`;
        }
        fitText(painter, desc, {
            x: circuit.geometry().rectForSuperpositionDisplay().x - 5,
            y: gridRect.bottom() + SUPERPOSITION_GRID_LABEL_SPAN + 20,
            align: 'right',
            baseline: 'bottom',
            fill: CanvasTheme.error.text,
            font: {fontSize: 14, fontFamily: Typography.DEFAULT_FONT_FAMILY},
            width: 800,
            height: 50
        });
    }
}

function invalidateCircuitLabelCache() {
    _cachedRowLabelDrawer.clear();
    _cachedColLabelDrawer.clear();
}

export {paintCircuit, invalidateCircuitLabelCache}
