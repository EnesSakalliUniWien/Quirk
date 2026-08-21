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

import {CIRCUIT_OP_HORIZONTAL_SPACING, CIRCUIT_OP_LEFT_SPACING} from "./CircuitLayoutConstants.js"
import {
    findGateOverlappingPos,
    findGateWithButtonContaining,
    findModificationIndex,
    findModificationIndex_helperColRow,
    findOpHalfColumnAt,
    findWireWithInitialStateAreaContaining,
    indexOfDisplayedColumnAt,
    indexOfDisplayedRowAt,
    toColumnSpaceCoordinate,
    wireIndexAt,
    wireInitialStateClickableRect,
} from "./CircuitHitTesting.js"
import {
    afterDropping,
    previewDrop,
    tryClick,
    tryGrab,
    withJustEnoughWires,
} from "./CircuitEditing.js"
import {paintCircuit} from "./CircuitPainting.js"
import {CachablePainting} from "../draw/CachablePainting.js"
import {CircuitDefinition} from "../circuit/CircuitDefinition.js"
import {CircuitStats} from "../circuit/CircuitStats.js"
import {Layout} from "../config/Layout.js"
import {Palette} from "../config/Palette.js"
import {Simulation} from "../config/Simulation.js"
import {Typography} from "../config/Typography.js"
import {DetailedError} from "../base/DetailedError.js"
import {equate} from "../base/Equate.js"
import {Format} from "../base/Format.js"
import {GateColumn} from "../circuit/GateColumn.js"
import {GateDrawParams} from "../draw/GateDrawParams.js"
import {GatePainting} from "../draw/GatePainting.js"
import {Hand} from "../ui/Hand.js"
import {MathPainter} from "../draw/MathPainter.js"
import {Point} from "../math/Point.js"
import {Matrix} from "../math/Matrix.js"
import {Rect} from "../math/Rect.js"
import {Util} from "../base/Util.js"
import {seq, Seq} from "../base/Seq.js"
import {paintBlochSphereDisplay} from "../gates/BlochSphereDisplay.js"



/** Stands in for the half of a basis state's bits that the other axis of the amplitude grid supplies. */

const EXTRA_COLS_FOR_SINGLE_QUBIT_DISPLAYS = 2;

class DisplayedCircuit {
    /**
     *
     * @param {!number} top
     * @param {!CircuitDefinition} circuitDefinition
     * @param {undefined|!int} compressedColumnIndex
     * @param {undefined|!{col: !int, row: undefined|!int, resizeStyle: !boolean}} highlightedSlot
     * @param {undefined|!int} extraWireStartIndex
     * @private
     */
    constructor(top, circuitDefinition, compressedColumnIndex, highlightedSlot, extraWireStartIndex) {
        if (!Number.isFinite(top)) {
            throw new DetailedError("Bad top", {top, circuitDefinition});
        }
        if (!(circuitDefinition instanceof CircuitDefinition)) {
            throw new DetailedError("Bad circuitDefinition", {top, circuitDefinition});
        }
        /**
         * @type {!number}
         */
        this.top = top;
        /**
         * @type {!CircuitDefinition}
         */
        this.circuitDefinition = circuitDefinition;
        /**
         * @type {undefined|!int}
         * @private
         */
        this._compressedColumnIndex = compressedColumnIndex;
        /**
         * @type {undefined|!{col: !int, row: undefined|!int, resizeStyle: !boolean}}
         * @private
         */
        this._highlightedSlot = highlightedSlot;
        /**
         * @type {undefined|!int}
         * @private
         */
        this._extraWireStartIndex = extraWireStartIndex;
        /**
         * How far right the output displays are pushed so they end at the right edge of the available area.
         * Recomputed from the available width on every layout pass; not part of the circuit's identity.
         * @type {!number}
         * @private
         */
        this._displayShift = 0;
    }

    /**
     * Right-aligns the output displays to the available width, without ever pulling them left of the circuit.
     * @param {!number} availableWidth
     */
    updateDisplayShift(availableWidth) {
        this._displayShift = 0;
        this._displayShift = Math.max(0, availableWidth - this.desiredWidth());
    }

    /**
     * @param {!int} operationIndex
     * @returns {!boolean} Whether the column holds output displays instead of circuit operations.
     * @private
     */
    _isOutputDisplayColumn(operationIndex) {
        return operationIndex > this.clampedCircuitColCount();
    }

    /**
     * @param {!number} top
     * @returns {!DisplayedCircuit}
     */
    static empty(top) {
        return new DisplayedCircuit(
            top,
            new CircuitDefinition(Simulation.MIN_WIRE_COUNT, []),
            undefined,
            undefined,
            undefined);
    }

    /**
     * @param {!number} top
     * @returns {!DisplayedCircuit}
     */
    withTop(top) {
        return new DisplayedCircuit(
            top,
            this.circuitDefinition,
            this._compressedColumnIndex,
            this._highlightedSlot,
            this._extraWireStartIndex);
    }

    /**
     * @returns {!boolean}
     */
    isBeingEdited() {
        return this._extraWireStartIndex !== undefined;
    }

    /**
     * The number of wires that were in the circuit before picking up a gate, or the number that will be in the circuit
     * after dropping a gate; whichever is larger.
     * @returns {!int}
     * @private
     */
    _groundedWireCount() {
        let pseudoCount =
            this._extraWireStartIndex !== undefined && this._extraWireStartIndex !== Simulation.MAX_WIRE_COUNT ? 1 : 0;

        let n = Math.max(Simulation.MIN_WIRE_COUNT, this.circuitDefinition.numWires) - pseudoCount;
        return Math.max(n, this.circuitDefinition.minimumRequiredWireCount());
    }

    /**
     * @param {!boolean=true} forTooltip
     * @returns {!number}
     */
    desiredHeight(forTooltip=false) {
        if (forTooltip) {
            return this.circuitDefinition.numWires * Layout.WIRE_SPACING;
        }
        return this._groundedWireCount() * Layout.WIRE_SPACING + 105;
    }

    /**
     * @param {!boolean=true} forTooltip
     * @returns {!number}
     */
    desiredWidth(forTooltip=false) {
        if (forTooltip) {
            return this.opRect(this.circuitDefinition.columns.length - 1).right() + CIRCUIT_OP_LEFT_SPACING;
        }
        return this._rectForSuperpositionDisplay().right() + 101;
    }

    /**
     * @param {!int} wireIndex
     * @returns {!Rect}
     */
    wireRect(wireIndex) {
        if (wireIndex < 0) {
            throw new DetailedError("Bad wireIndex", {wireIndex});
        }
        return new Rect(0, this.top + Layout.WIRE_SPACING * wireIndex, Infinity, Layout.WIRE_SPACING);
    }








    /**
     * @param {!int} operationIndex
     * @returns {Rect!}
     */
    opRect(operationIndex) {
        let opWidth = Layout.GATE_RADIUS * 2;
        let opSeparation = opWidth + CIRCUIT_OP_HORIZONTAL_SPACING;
        let tweak = 0;
        if (this._compressedColumnIndex !== undefined && operationIndex === this._compressedColumnIndex) {
            tweak = opSeparation / 2;
        }
        if (this._compressedColumnIndex !== undefined && operationIndex > this._compressedColumnIndex) {
            tweak = opSeparation;
        }

        let dx = opSeparation * operationIndex - tweak + CIRCUIT_OP_LEFT_SPACING;
        if (this._isOutputDisplayColumn(operationIndex)) {
            dx += this._displayShift;
        }
        return new Rect(dx, this.top, opWidth, this.desiredHeight());
    }

    /**
     * @param {!int} wireIndex
     * @param {!int} operationIndex
     * @param {!int=} width
     * @param {!int=} height
     */
    gateRect(wireIndex, operationIndex, width=1, height=1) {
        let op = this.opRect(operationIndex);
        let wire = this.wireRect(wireIndex);
        let r = new Rect(
            op.center().x - Layout.GATE_RADIUS,
            wire.center().y - Layout.GATE_RADIUS,
            2*Layout.GATE_RADIUS + (width-1)*Layout.WIRE_SPACING,
            2*Layout.GATE_RADIUS + (height-1)*Layout.WIRE_SPACING);

        return new Rect(Math.round(r.x - 0.5) + 0.5, Math.round(r.y - 0.5) + 0.5, Math.round(r.w), Math.round(r.h));
    }

    /**
     * @returns {!DisplayedCircuit}
     */
    afterTidyingUp() {
        return this.
            withCircuit(this.circuitDefinition.
                withUncoveredColumnsRemoved().
                withHeightOverlapsFixed().
                withWidthOverlapsFixed().
                withUncoveredColumnsRemoved().
                withTrailingSpacersIncluded()).
            _withCompressedColumnIndex(undefined).
            _withExtraWireStartIndex(undefined).
            _withHighlightedSlot(undefined);
    }

    /**
     * @param {!number} y
     * @returns {undefined|!int}
     */
    indexOfDisplayedRowAt(y) {
        return indexOfDisplayedRowAt(this, y);
    }

    /**
     * @param {!Point} pos
     * @returns {undefined|!Point}
     */
    findGateWithButtonContaining(pos) {
        return findGateWithButtonContaining(this, pos);
    }

    /**
     * @param {!Point} pt
     * @returns {undefined|!int}
     */
    findWireWithInitialStateAreaContaining(pt) {
        return findWireWithInitialStateAreaContaining(this, pt);
    }

    /**
     * @param {!Painter} painter
     * @param {!Hand} hand
     * @param {!CircuitStats} stats
     */
    paint(painter, hand, stats) {
        paintCircuit(this, painter, hand, stats);
    }

    /**
     * @param {!DisplayedCircuit|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        if (this === other) {
            return true;
        }
        return other instanceof DisplayedCircuit &&
            this.top === other.top &&
            this.circuitDefinition.isEqualTo(other.circuitDefinition) &&
            this._compressedColumnIndex === other._compressedColumnIndex &&
            this._extraWireStartIndex === other._extraWireStartIndex &&
            equate(this._highlightedSlot, other._highlightedSlot);
    }



    /**
     * @param {!int} col
     * @param {!int} row
     * @param {!Array.<!Point>} focusPosPts
     * @returns {!{isHighlighted: !boolean, isResizeShowing: !boolean, isResizeHighlighted: !boolean}}
     * @private
     */
    _highlightStatusAt(col, row, focusPosPts) {
        if (this._highlightedSlot !== undefined) {
            if (this._highlightedSlot.col === col && this._highlightedSlot.row === row) {
                return {
                    isResizeShowing: true,
                    isResizeHighlighted: this._highlightedSlot.resizeStyle,
                    isHighlighted: !this._highlightedSlot.resizeStyle
                };
            }
        }

        let gate = this.circuitDefinition.gateInSlot(col, row);
        if (gate === undefined || this._highlightedSlot !== undefined) {
            return {
                isResizeShowing: false,
                isResizeHighlighted: false,
                isHighlighted: false
            };
        }

        let gateRect = this.gateRect(row, col, gate.width, gate.height);
        let resizeTabRect = GatePainting.rectForResizeTab(gateRect);

        let isOverGate = pos => {
            let overGate = findGateOverlappingPos(this, pos);
            return overGate !== undefined && overGate.col === col && overGate.row === row;
        };
        let isNotCoveredAt = pos => {
            let g = findGateOverlappingPos(this, pos);
            return g === undefined || (g.col === col && g.row === row);
        };
        let isOverGateResizeTab = pos => isNotCoveredAt(pos) && resizeTabRect.containsPoint(pos);

        let isResizeHighlighted = gate.canChangeInSize() && seq(focusPosPts).any(isOverGateResizeTab);
        let isHighlighted = !isResizeHighlighted && seq(focusPosPts).any(isOverGate);
        let isResizeShowing = gate.canChangeInSize() && (isResizeHighlighted || isHighlighted);

        return {isHighlighted, isResizeShowing, isResizeHighlighted};
    }







    /**
     * @param {!Hand} hand
     * @returns {!DisplayedCircuit}
     */
    previewDrop(hand) {
        return previewDrop(this, hand);
    }

    /**
     * @param {!Hand} hand
     * @returns {!DisplayedCircuit}
     */
    afterDropping(hand) {
        return afterDropping(this, hand);
    }

    /**
     * @param {!CircuitDefinition} circuitDefinition
     * @returns {!DisplayedCircuit}
     */
    withCircuit(circuitDefinition) {
        return new DisplayedCircuit(
            this.top,
            circuitDefinition,
            this._compressedColumnIndex,
            this._highlightedSlot,
            this._extraWireStartIndex);
    }

    /**
     * @param {undefined|!int} compressedColumnIndex
     * @returns {!DisplayedCircuit}
     * @private
     */
    _withCompressedColumnIndex(compressedColumnIndex) {
        return new DisplayedCircuit(
            this.top,
            this.circuitDefinition,
            compressedColumnIndex,
            this._highlightedSlot,
            this._extraWireStartIndex);
    }

    /**
     * @param {undefined|!{col: undefined|!int, row: undefined|!int, resizeStyle: !boolean}} slot
     * @returns {!DisplayedCircuit}
     * @private
     */
    _withHighlightedSlot(slot) {
        return new DisplayedCircuit(
            this.top,
            this.circuitDefinition,
            this._compressedColumnIndex,
            slot,
            this._extraWireStartIndex);
    }

    /**
     * @param {undefined|!int} extraWireStartIndex
     * @returns {!DisplayedCircuit}
     * @private
     */
    _withExtraWireStartIndex(extraWireStartIndex) {
        return new DisplayedCircuit(
            this.top,
            this.circuitDefinition,
            this._compressedColumnIndex,
            this._highlightedSlot,
            extraWireStartIndex);
    }

    /**
     * @param {undefined|!int} fallbackExtraWireStartIndex
     * @returns {!DisplayedCircuit}
     * @private
     */
    _withFallbackExtraWireStartIndex(fallbackExtraWireStartIndex) {
        return this._withExtraWireStartIndex(this._extraWireStartIndex || fallbackExtraWireStartIndex);
    }

    /**
     * @param {!Hand} hand
     * @param {!int} extraWireCount
     * @returns {!DisplayedCircuit}
     */
    withJustEnoughWires(hand, extraWireCount) {
        return withJustEnoughWires(this, hand, extraWireCount);
    }

    /**
     * @param {!Hand} hand
     * @returns {undefined|!DisplayedCircuit}
     */
    tryClick(hand) {
        return tryClick(this, hand);
    }

    /**
     * @param {!Hand} hand
     * @param {!boolean=false} duplicate
     * @param {!boolean=false} wholeColumn
     * @param {!boolean=false} ignoreResizeTabs
     * @param {!boolean=false} alt Whether or not to replace grabbed gates with their alternates.
     * @returns {!{newCircuit: !DisplayedCircuit, newHand: !Hand}}
     */
    tryGrab(hand, duplicate=false, wholeColumn=false, ignoreResizeTabs=false, alt=false) {
        return tryGrab(this, hand, duplicate, wholeColumn, ignoreResizeTabs, alt);
    }

    /**
     * @returns {Infinity|!number}
     */
    stableDuration() {
        return this.circuitDefinition.stableDuration();
    }

    /**
     * @returns {!int}
     */
    importantWireCount() {
        return Math.max(
            this.circuitDefinition.numWires - (this._extraWireStartIndex === Simulation.MAX_WIRE_COUNT ? 0 : 1),
            Simulation.MIN_WIRE_COUNT,
            this.circuitDefinition.minimumRequiredWireCount());
    }


    /**
     * @returns {!number} The number of columns used for drawing the circuit, before the output display.
     */
    clampedCircuitColCount() {
        return Math.max(
            this.circuitDefinition.columns.length,
            Simulation.MIN_COL_COUNT + (this._compressedColumnIndex !== undefined ? 1 : 0));
    }



    /**
     * @param {!CircuitStats} stats
     * @returns {!Matrix}
     * @private
     */
    _outputStateAsMatrix(stats) {
        let numWire = this.importantWireCount();
        let buf = stats.finalState.rawBuffer();
        if (stats.circuitDefinition.numWires !== numWire) {
            let r = new Float32Array(2 << numWire);
            r.set(buf.slice(0, r.length));
            buf = r;
        }

        let [colWires, rowWires] = [Math.floor(numWire/2), Math.ceil(numWire/2)];
        let [colCount, rowCount] = [1 << colWires, 1 << rowWires];
        //noinspection JSCheckFunctionSignatures
        return new Matrix(colCount, rowCount, buf);
    }

    /**
     * @returns {!Rect}
     * @private
     */
    _rectForSuperpositionDisplay() {
        let col = this.clampedCircuitColCount() + EXTRA_COLS_FOR_SINGLE_QUBIT_DISPLAYS + 1;
        let numWire = this.importantWireCount();
        let [colWires, rowWires] = [Math.floor(numWire/2), Math.ceil(numWire/2)];
        let [colCount, rowCount] = [1 << colWires, 1 << rowWires];
        let topRect = this.gateRect(0, col);
        let bottomRect = this.gateRect(numWire-1, col);
        let gridRect = new Rect(topRect.x, topRect.y, 0, bottomRect.bottom() - topRect.y);
        return gridRect.withW(gridRect.h * (colCount/rowCount));
    }


    /**
     * Parses a text diagram of a circuit, with positions marked by numbers, into a displayed circuit and a list of the
     * positions of the marked points.
     *
     * Note: All lines should start with a pipe (|).
     * Note: Follow a number with a carat (^) to indicate a position above the carat.
     * Note: Separate wires with blank lines. Also start and end with blank lines.
     * Note: Hyphens (-) mark wires, but can't be used at gate locations. Use a char mapped to undefined for that.
     *
     * Example diagram, which could be used to seed a drag of the X gate from after the control to under the control:
     *    |
     *    |-H-C-X-
     *    |    0^
     *    |-+-1-+-
     *    |
     *
     * @param {!string} diagramText
     * @param {!Map<!string, undefined|!Gate>} gateMap
     * @returns {!{circuit: !DisplayedCircuit, pts: !Array.<!Point>}}
     */
    static fromTextDiagram(gateMap, diagramText) {
        let lines = diagramText.split('\n').map(e => {
            let p = e.split('|');
            if (p.length !== 2) {
                throw new DetailedError('Bad diagram', {diagramText, gateMap});
            }
            return p[1];
        });
        let circuitDiagramSubset = seq(lines).
            skip(1).
            stride(2).
            map(line => seq(line).skip(1).stride(2).join("")).
            join('\n');
        let top = 10;
        let circuit = new DisplayedCircuit(
            top,
            CircuitDefinition.fromTextDiagram(gateMap, circuitDiagramSubset),
            undefined,
            undefined,
            undefined);
        let pts = Seq.naturals().
            takeWhile(k => diagramText.indexOf(k) !== -1).
            map(k => {
                let pos = seq(lines).mapWithIndex((line, row) => ({row, col: line.indexOf(k)})).
                    filter(e => e.col !== -1).
                    single();
                if (lines[pos.row][pos.col + 1] === '^') {
                    pos.row -= 1;
                    pos.col += 1;
                }
                return new Point(
                    pos.col * Layout.WIRE_SPACING / 2 + 35.5,
                    pos.row * Layout.WIRE_SPACING / 2 + 10.5);
            }).toArray();
        return {circuit, pts};
    }
}

/**
 * @param {!Painter} painter
 * @param {!CircuitDefinition} circuitDefinition
 * @param {!Rect} rect
 * @param {!boolean} showWires
 * @param {!number} time
 * @returns {!{maxW: !number, maxH: !number}}
 */
function drawCircuitTooltip(painter, circuitDefinition, rect, showWires, time) {
    let displayed = new DisplayedCircuit(
        0,
        circuitDefinition,
        undefined,
        undefined,
        undefined);
    let neededWidth = displayed.desiredWidth(true);
    let neededHeight = displayed.desiredHeight(true);
    let scaleX = rect.w / neededWidth;
    let scaleY = rect.h / neededHeight;
    if (showWires) {
        let s = Math.min(scaleX, scaleY);
        scaleX = s;
        scaleY = s;
    }
    let stats = CircuitStats.withNanDataFromCircuitAtTime(circuitDefinition, time);
    try {
        painter.ctx.save();
        painter.ctx.translate(rect.x, rect.y);
        painter.ctx.scale(Math.min(1, scaleX), Math.min(1, scaleY));
        painter.ctx.translate(0, 0);
        displayed.paint(
            painter,
            Hand.EMPTY,
            stats,
            true,
            showWires);
    } finally {
        painter.ctx.restore();
    }
    return {maxW: neededWidth*scaleX, maxH: neededHeight*scaleY};
}

/**
 * @param {!GateDrawParams} args
 */
let GATE_CIRCUIT_DRAWER = args => {
    let circuit = args.gate.knownCircuit;
    if (circuit === undefined || args.gate.symbol !== '') {
        if (args.gate.stableDuration() === Infinity) {
            GatePainting.DEFAULT_DRAWER(args);
        } else {
            GatePainting.makeCycleDrawer()(args);
        }
        return;
    }

    let toolboxColor = args.gate.stableDuration() === Infinity ?
        Palette.GATE_FILL_COLOR :
        Palette.TIME_DEPENDENT_HIGHLIGHT_COLOR;
    GatePainting.paintBackground(args, toolboxColor);
    drawCircuitTooltip(args.painter, args.gate.knownCircuitNested, args.rect, false, args.stats.time);
    GatePainting.paintOutline(args);
    if (args.isHighlighted) {
        args.painter.ctx.save();
        args.painter.ctx.globalAlpha *= 0.9;
        args.painter.fillRect(args.rect, Palette.HIGHLIGHTED_GATE_FILL_COLOR);
        args.painter.ctx.restore();
    }
    GatePainting.paintOutline(args);
};




export {DisplayedCircuit, drawCircuitTooltip, GATE_CIRCUIT_DRAWER}
