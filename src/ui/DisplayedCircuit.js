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

/** @type {!number} */
let CIRCUIT_OP_HORIZONTAL_SPACING = 10;
/** @type {!number} */
// Matches Layout.TOOLBOX_MARGIN_X so gate columns align with the toolbox groups.
let CIRCUIT_OP_LEFT_SPACING = 32;


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
     * @param {!number} y
     * @returns {!int}
     */
    wireIndexAt(y) {
        return Math.floor((y - this.top) / Layout.WIRE_SPACING);
    }

    //noinspection JSMethodCanBeStatic
    /**
     * @param {!number} x
     * @returns {!number} The continuous column-space coordinate corresponding to the given display-space coordinate.
     * @private
     */
    toColumnSpaceCoordinate(x) {
        let spacing = (CIRCUIT_OP_HORIZONTAL_SPACING + Layout.GATE_RADIUS * 2);
        let left = CIRCUIT_OP_LEFT_SPACING - CIRCUIT_OP_HORIZONTAL_SPACING / 2;
        return (x - left) / spacing - 0.5;
    }

    /**
     * @param {!number} y
     * @returns {undefined|!int}
     */
    indexOfDisplayedRowAt(y) {
        let i = Math.floor((y - this.top) / Layout.WIRE_SPACING);
        if (i < 0 || i >= this.circuitDefinition.numWires) {
            return undefined;
        }
        return i;
    }

    /**
     * @param {!number} x
     * @returns {undefined|!int}
     */
    indexOfDisplayedColumnAt(x) {
        let col = this.toColumnSpaceCoordinate(x);
        let i;
        if (this._compressedColumnIndex === undefined || col < this._compressedColumnIndex - 0.75) {
            i = Math.round(col);
        } else if (col < this._compressedColumnIndex - 0.25) {
            i = this._compressedColumnIndex;
        } else {
            i = Math.round(col) - 1;
        }

        if (i < 0 || i >= this.circuitDefinition.columns.length) {
            return undefined;
        }

        return i;
    }

    /**
     * @param {!Point} p
     * @returns {undefined|!number}
     */
    findOpHalfColumnAt(p) {
        if (p.x < 0 || p.y < this.top || p.y > this.top + this.desiredHeight()) {
            return undefined;
        }

        return Math.max(-0.5, Math.round(this.toColumnSpaceCoordinate(p.x) * 2) / 2);
    }

    /**
     * @param {!Hand} hand
     * @returns {undefined|!{col: !int, row: !int, halfColIndex: !number}}
     * @private
     */
    _findModificationIndex_helperColRow(hand) {
        if (hand.pos === undefined || hand.heldGate === undefined) {
            return undefined;
        }
        let pos = hand.pos.minus(hand.holdOffset).plus(new Point(Layout.GATE_RADIUS, Layout.GATE_RADIUS));
        let halfColIndex = this.findOpHalfColumnAt(pos);
        let row = this.indexOfDisplayedRowAt(pos.y);
        if (halfColIndex === undefined || row === undefined) {
            return undefined;
        }
        let col = Math.ceil(halfColIndex);
        return {col, row, halfColIndex};
    }

    /**
     * @param {!Hand} hand
     * @returns {?{ col : !number, row : !number, isInsert : !boolean }}
     */
    findModificationIndex(hand) {
        let loc = this._findModificationIndex_helperColRow(hand);
        if (loc === undefined) {
            return undefined;
        }
        let {col, row, halfColIndex} = loc;

        let isInsert = Math.abs(halfColIndex % 1) === 0.5;
        if (col >= this.circuitDefinition.columns.length) {
            return {col: col, row: row, isInsert: isInsert};
        }

        if (!isInsert) {
            let mustInsert = this.circuitDefinition.isSlotRectCoveredByGateInSameColumn(
                col, row, hand.heldGate.height);
            if (mustInsert) {
                let isAfter = hand.pos.x > this.opRect(col).center().x;
                isInsert = true;
                if (isAfter) {
                    col += 1;
                }
            }
        }

        return {col: col, row: row, isInsert: isInsert};
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
            let overGate = this.findGateOverlappingPos(pos);
            return overGate !== undefined && overGate.col === col && overGate.row === row;
        };
        let isNotCoveredAt = pos => {
            let g = this.findGateOverlappingPos(pos);
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
        return hand.heldRow !== undefined ? this._previewDropMovedRow(hand) :
            hand.heldColumn !== undefined ? this._previewDropMovedGateColumn(hand) :
            hand.heldGate !== undefined ? this._previewDropMovedGate(hand) :
            this._previewResizedGate(hand);
    }

    /**
     * @param {!Hand} hand
     * @returns {!DisplayedCircuit}
     * @private
     */
    _previewDropMovedRow(hand) {
        if (hand.pos === undefined) {
            return this;
        }
        let handWire = this.wireIndexAt(hand.pos.y);
        if (handWire < 0 || handWire >= this.circuitDefinition.numWires) {
            // Dragged the row out of the circuit.
            return this;
        }

        let heldRowHeight = seq(hand.heldRow.gates).map(g => g === undefined ? 1 : g.height).max(1);
        handWire = Math.min(handWire, this.circuitDefinition.numWires - heldRowHeight);

        let newCols = [];
        for (let c = 0; c < this.circuitDefinition.columns.length; c++) {
            let gates = [...this.circuitDefinition.columns[c].gates];
            gates.splice(handWire, 0, hand.heldRow.gates[c]);
            gates.pop();
            newCols.push(new GateColumn(gates));
        }

        let newInitialStates = seq(this.circuitDefinition.customInitialValues.entries()).
            map(([k, v]) => [k + (k >= handWire ? 1 : 0), v]).
            toMap(([k, _]) => k, ([_, v]) => v);
        if (hand.heldRow.initialState !== undefined) {
            newInitialStates.set(handWire, hand.heldRow.initialState);
        }
        let newCircuitDef = this.circuitDefinition.withColumns(newCols).withInitialStates(newInitialStates);

        return this.withCircuit(newCircuitDef).
            _withHighlightedSlot({row: handWire, col: undefined, resizeStyle: false});
    }

    /**
     * @param {!Hand} hand
     * @returns {!DisplayedCircuit}
     * @private
     */
    _previewDropMovedGateColumn(hand) {
        if (hand.pos === undefined) {
            return this;
        }
        let handWire = this.wireIndexAt(hand.pos.y);
        if (handWire < 0 || handWire >= Simulation.MAX_WIRE_COUNT || hand.pos.x <= 1) {
            // Dragged the gate column out of the circuit.
            return this;
        }


        let halfCol = this.findOpHalfColumnAt(new Point(hand.pos.x, this.top));
        let mustInsert = halfCol % 1 === 0 &&
            this.circuitDefinition.columns[halfCol] !== undefined &&
            !this.circuitDefinition.columns[halfCol].isEmpty();
        if (mustInsert) {
            let isAfter = hand.pos.x > this.opRect(halfCol).center().x;
            halfCol += isAfter ? 0.5 : -0.5;
        }

        let col = Math.ceil(halfCol);
        let isInsert = halfCol % 1 !== 0;

        let rowShift = Math.round((hand.pos.y - hand.holdOffset.y - this.top) / Layout.WIRE_SPACING);
        let newCircuitDef = this._shiftAndSpliceColumn(rowShift, [...hand.heldColumn.gates], col, isInsert);

        return this.withCircuit(newCircuitDef).
            _withHighlightedSlot({row: undefined, col, resizeStyle: false}).
            _withCompressedColumnIndex(isInsert ? col : undefined);
    }

    _shiftAndSpliceColumn(rowShift, gatesOfCol, insertCol, isInsert) {
        // Move gates upward.
        while (rowShift < 0 && gatesOfCol[0] === undefined) {
            gatesOfCol.shift();
            gatesOfCol.push(undefined);
            rowShift += 1;
        }

        // Shift gates downward.
        while (rowShift > 0 && new GateColumn(gatesOfCol).minimumRequiredWireCount() < Simulation.MAX_WIRE_COUNT) {
            gatesOfCol.unshift(undefined);
            if (new GateColumn(gatesOfCol).minimumRequiredWireCount() < gatesOfCol.length) {
                gatesOfCol.pop();
            }
            rowShift -= 1;
        }

        let expandedCircuit = this.circuitDefinition.withWireCount(gatesOfCol.length);
        let newCols = [...expandedCircuit.columns];

        // Move displays rightward.
        while (newCols.length < insertCol) {
            newCols.push(GateColumn.empty(expandedCircuit.numWires));
        }

        newCols.splice(insertCol, isInsert ? 0 : 1, new GateColumn(gatesOfCol));
        return expandedCircuit.withColumns(newCols).withTrailingSpacersIncluded();
    }

    /**
     * @param {!Hand} hand
     * @returns {!DisplayedCircuit}
     * @private
     */
    _previewDropMovedGate(hand) {
        let modificationPoint = this.findModificationIndex(hand);
        if (modificationPoint === undefined) {
            return this;
        }

        // Use the grab offset instead of the gate height so that tall gates are 'sticky' when dragging downward: they
        // aren't removed until the hand actually leaves the circuit area.
        let handRowOffset = Math.floor(hand.holdOffset.y/Layout.WIRE_SPACING);
        if (modificationPoint.row + handRowOffset >= this.circuitDefinition.numWires) {
            return this;
        }

        let addedGate = hand.heldGate;

        let emptyCol = GateColumn.empty(this.circuitDefinition.numWires);
        let i = modificationPoint.col;
        let isInserting = modificationPoint.isInsert;
        let row = Math.min(modificationPoint.row, Math.max(0, Simulation.MAX_WIRE_COUNT - addedGate.height));
        let newCols = seq(this.circuitDefinition.columns).
            padded(i, emptyCol).
            ifThen(isInserting, s => s.withInsertedItem(i, emptyCol)).
            padded(i + addedGate.width, emptyCol).
            withTransformedItem(i, c => c.withGatesAdded(row, new GateColumn([addedGate]))).
            toArray();
        let newWireCount = Math.max(
            this._extraWireStartIndex || 0,
            Math.max(
                this.circuitDefinition.numWires,
                addedGate.height + row));
        if (newWireCount > Simulation.MAX_WIRE_COUNT) {
            return this;
        }

        let newCircuitDef = this.circuitDefinition.
            withColumns(newCols).
            withWireCount(newWireCount);
        return this.withCircuit(newCircuitDef).
            _withHighlightedSlot({row, col: modificationPoint.col, resizeStyle: false}).
            _withCompressedColumnIndex(isInserting ? i : undefined).
            _withFallbackExtraWireStartIndex(this.circuitDefinition.numWires);
    }

    /**
     * @param {!Hand} hand
     * @returns {!DisplayedCircuit}
     * @private
     */
    _previewResizedGate(hand) {
        if (hand.resizingGateSlot === undefined || hand.pos === undefined) {
            return this;
        }
        let gate = this.circuitDefinition.gateInSlot(hand.resizingGateSlot.x, hand.resizingGateSlot.y);
        if (gate === undefined) {
            return this;
        }
        let row = Math.min(
            this.wireIndexAt(hand.pos.y - hand.holdOffset.y),
            Simulation.MAX_WIRE_COUNT - 1);
        let newGate = seq(gate.gateFamily).minBy(g => Math.abs(g.height - (row - hand.resizingGateSlot.y + 1)));
        let newWireCount = Math.min(Simulation.MAX_WIRE_COUNT,
            Math.max(this.circuitDefinition.numWires, newGate.height + hand.resizingGateSlot.y));
        let newCols = seq(this.circuitDefinition.columns).
            withTransformedItem(hand.resizingGateSlot.x,
                colObj => new GateColumn(seq(colObj.gates).
                    withOverlayedItem(hand.resizingGateSlot.y, newGate).
                    toArray())).
            toArray();

        let newCircuitWithoutOverlapFix = this.circuitDefinition.withColumns(newCols).withWireCount(newWireCount);
        let newCircuitWithOverlapFix = newCircuitWithoutOverlapFix.withHeightOverlapsFixed();
        let newCircuit = newCircuitWithOverlapFix.withTrailingSpacersIncluded();
        return this.withCircuit(newCircuit).
            _withHighlightedSlot(this._highlightedSlot).
            _withCompressedColumnIndex(newCircuitWithoutOverlapFix.isEqualTo(newCircuitWithOverlapFix) ?
                undefined :
                hand.resizingGateSlot.x + 1).
            _withFallbackExtraWireStartIndex(this.circuitDefinition.numWires);
    }

    /**
     * @param {!Hand} hand
     * @returns {!DisplayedCircuit}
     */
    afterDropping(hand) {
        return this.previewDrop(hand)._withCompressedColumnIndex(undefined);
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
        let neededWireCountForPlacement = hand.heldGate !== undefined ? hand.heldGate.height : 0;
        let desiredWireCount = this.circuitDefinition.minimumRequiredWireCount();
        let clampedWireCount = Math.min(
            Simulation.MAX_WIRE_COUNT,
            Math.max(
                Math.min(1, neededWireCountForPlacement),
                Math.max(Simulation.MIN_WIRE_COUNT, desiredWireCount) + extraWireCount));
        return this.withCircuit(this.circuitDefinition.withWireCount(clampedWireCount)).
            _withExtraWireStartIndex(extraWireCount === 0 ? undefined : this.circuitDefinition.numWires);
    }

    /**
     * @param {!Point} pos
     * @returns {undefined|!{col: !int, row: !int, offset: !Point}}
     */
    findGateOverlappingPos(pos) {
        let col = this.indexOfDisplayedColumnAt(pos.x);
        let row = this.indexOfDisplayedRowAt(pos.y);
        if (col === undefined || row === undefined) {
            return undefined;
        }

        let target = this.circuitDefinition.findGateCoveringSlot(col, row);
        if (target === undefined) {
            return undefined;
        }

        let gateRect = this.gateRect(target.row, target.col, target.gate.width, target.gate.height);
        if (!gateRect.containsPoint(pos)) {
            return undefined;
        }

        return {col: target.col, row: target.row, offset: pos.minus(gateRect.topLeft())};
    }

    /**
     * @param {!Point} pos
     * @returns {undefined|!{col: !int, row: !int, gate: !Gate}}
     */
    findGateWithButtonContaining(pos) {
        let foundPt = this.findGateOverlappingPos(pos);
        if (foundPt === undefined) {
            return undefined;
        }

        let gate = this.circuitDefinition.gateInSlot(foundPt.col, foundPt.row);
        if (gate.onClickGateFunc === undefined) {
            return undefined;
        }

        let buttonRect = GatePainting.gateButtonRect(this.gateRect(foundPt.row, foundPt.col, gate.width, gate.height));
        if (!buttonRect.containsPoint(pos)) {
            return undefined;
        }

        return {col: foundPt.col, row: foundPt.row, gate};
    }

    /**
     * @param {!int} wire
     * @returns {!Rect}
     * @private
     */
    _wireInitialStateClickableRect(wire) {
        let r = this.wireRect(wire);
        r.x = 0;
        r.y += 5;
        r.w = 30;
        r.h -= 10;
        return r;
    }

    /**
     * @param {!Point} pt
     * @returns {undefined|!int}
     */
    findWireWithInitialStateAreaContaining(pt) {
        // Is it in the right vertical band; the one at the start of the circuit?
        if (pt.x < 0 || pt.x > 30) {
            return undefined;
        }

        // Which wire is it? Is it one that's actually in the circuit?
        let wire = this.wireIndexAt(pt.y);
        if (wire < 0 || wire >= this.circuitDefinition.numWires) {
            return undefined;
        }

        // Is it inside the intended click area, instead of just off to the side?
        let r = this._wireInitialStateClickableRect(wire);
        if (!r.containsPoint(pt)) {
            return undefined;
        }

        // Good to go.
        return wire;
    }

    /**
     * @param {!Hand} hand
     * @returns {undefined|!DisplayedCircuit}
     */
    tryClick(hand) {
        if (hand.pos === undefined || hand.heldGate !== undefined) {
            return undefined;
        }

        let clickedInitialStateWire = this.findWireWithInitialStateAreaContaining(hand.pos);
        if (clickedInitialStateWire !== undefined) {
            return this.withCircuit(this.circuitDefinition.withSwitchedInitialStateOn(clickedInitialStateWire))
        }

        let found = this.findGateWithButtonContaining(hand.pos);
        if (found === undefined) {
            return undefined;
        }

        let newGate = found.gate.onClickGateFunc(found.gate);
        let cols = [...this.circuitDefinition.columns];
        let col = cols[found.col];
        let gates = [...col.gates];
        gates.splice(found.row, 1, newGate);
        cols.splice(found.col, 1, new GateColumn(gates));
        return this.withCircuit(this.circuitDefinition.withColumns(cols));
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
        if (wholeColumn) {
            let grabRowResult = this._tryGrabRow(hand, alt);
            if (grabRowResult !== undefined) {
                return grabRowResult;
            }
            return this._tryGrabWholeColumn(hand, duplicate, alt) || {newCircuit: this, newHand: hand};
        }

        let newHand = hand;
        let newCircuit = this;
        if (!ignoreResizeTabs) {
            let resizing = this._tryGrabResizeTab(hand);
            if (resizing !== undefined) {
                newHand = resizing.newHand;
                newCircuit = resizing.newCircuit;
            }
        }

        return newCircuit._tryGrabGate(newHand, duplicate, alt) || {newCircuit, newHand};
    }

    /**
     * @param {!Hand} hand
     * @param {!boolean} alt
     * @returns {undefined|!{newCircuit: !DisplayedCircuit, newHand: !Hand}}
     */
    _tryGrabRow(hand, alt) {
        if (hand.pos === undefined) {
            return undefined;
        }

        // Which wire is it? Is it one that's actually in the circuit?
        let wire = this.wireIndexAt(hand.pos.y);
        if (wire < 0 || wire >= this.circuitDefinition.numWires) {
            return undefined;
        }

        // Is it inside the intended click area, instead of just off to the side?
        let r = this._wireInitialStateClickableRect(wire);
        if (!r.containsPoint(hand.pos)) {
            return undefined;
        }

        let {newCircuit, initialState, rowGates} = this._cutRow(wire);
        let holdOffset = new Point(0, hand.pos.y - r.y);
        if (alt) {
            rowGates = rowGates.map(e => e === undefined ? e : e.alternate);
        }
        return {
            newCircuit: this.withCircuit(newCircuit),
            newHand: hand.withHeldRow({initialState, gates: rowGates}, holdOffset)
        };
    }

    /**
     * @param {!int} row
     * @returns {!{newCircuit: !CircuitDefinition, rowGates: !Array.<undefined|!Gate>, initialState: *}}
     * @private
     */
    _cutRow(row) {
        let row_gates = [];
        let cols = [];
        for (let i = 0; i < this.circuitDefinition.columns.length; i++) {
            let col_gates = [...this.circuitDefinition.columns[i].gates];
            row_gates.push(col_gates[row]);
            col_gates.splice(row, 1);
            col_gates.push(undefined);
            cols.push(new GateColumn(col_gates));
        }
        let newInitialStates = seq(this.circuitDefinition.customInitialValues.entries()).
            filter(([k, _]) => k !== row).
            map(([k, v]) => [k - (k > row ? 1 : 0), v]).
            toMap(([k, _]) => k, ([_, v]) => v);
        return {
            newCircuit: this.circuitDefinition.withColumns(cols).withInitialStates(newInitialStates),
            rowGates: row_gates,
            initialState: this.circuitDefinition.customInitialValues.get(row)
        };
    }

    /**
     * @param {!Hand} hand
     * @param {!boolean} duplicate
     * @param {!boolean} alt
     * @returns {undefined|!{newCircuit: !DisplayedCircuit, newHand: !Hand}}
     */
    _tryGrabGate(hand, duplicate, alt) {
        if (hand.isBusy() || hand.pos === undefined) {
            return undefined;
        }

        let foundPt = this.findGateOverlappingPos(hand.pos);
        if (foundPt === undefined) {
            return undefined;
        }

        let {col, row, offset} = foundPt;
        let gate = this.circuitDefinition.columns[col].gates[row];
        if (alt) {
            gate = gate.alternate;
        }

        let remainingGates = seq(this.circuitDefinition.columns[col].gates).toArray();
        if (!duplicate) {
            remainingGates[row] = undefined;
        }

        let newCols = seq(this.circuitDefinition.columns).
            withOverlayedItem(col, new GateColumn(remainingGates)).
            toArray();
        return {
            newCircuit: new DisplayedCircuit(
                this.top,
                this.circuitDefinition.withColumns(newCols),
                undefined,
                undefined,
                this._extraWireStartIndex),
            newHand: hand.withHeldGate(gate, offset)
        };
    }

    /**
     * @param {!Hand} hand
     * @returns {!{newCircuit: !DisplayedCircuit, newHand: !Hand}}
     */
    _tryGrabResizeTab(hand) {
        if (hand.isBusy() || hand.pos === undefined) {
            return undefined;
        }

        for (let col = 0; col < this.circuitDefinition.columns.length; col++) {
            for (let row = 0; row < this.circuitDefinition.numWires; row++) {
                let gate = this.circuitDefinition.columns[col].gates[row];
                if (gate === undefined) {
                    continue;
                }
                let {isResizeHighlighted} =
                    this._highlightStatusAt(col, row, hand.hoverPoints());
                if (isResizeHighlighted) {
                    let offset = hand.pos.minus(this.gateRect(row + gate.height - 1, col, 1, 1).center());
                    return {
                        newCircuit: this._withHighlightedSlot({col, row, resizeStyle: true}),
                        newHand: hand.withResizeSlot(new Point(col, row), offset)
                    };
                }
            }
        }
        return undefined;
    }

    /**
     * @param {!Hand} hand
     * @param {!boolean} duplicate
     * @param {!boolean} alt Whether or not to replace grabbed gates with their alternates.
     * @returns {undefined|!{newCircuit: !DisplayedCircuit, newHand: !Hand}}
     * @private
     */
    _tryGrabWholeColumn(hand, duplicate, alt) {
        if (hand.isBusy() || hand.pos === undefined) {
            return undefined;
        }

        let col = Math.round(this.toColumnSpaceCoordinate(hand.pos.x));
        if (col < 0 || col >= this.circuitDefinition.columns.length || this.circuitDefinition.columns[col].isEmpty()) {
            return undefined;
        }

        let newCols = [...this.circuitDefinition.columns];
        if (!duplicate) {
            newCols.splice(col, 1, GateColumn.empty(this.circuitDefinition.numWires));
        }

        let holdOffset = new Point(0, this.wireIndexAt(hand.pos.y) * Layout.WIRE_SPACING + Layout.WIRE_SPACING/2);
        let grabbedGates = this.circuitDefinition.columns[col];
        if (alt) {
            grabbedGates = new GateColumn(grabbedGates.gates.map(e => e === undefined ? e : e.alternate));
        }
        return {
            newCircuit: this.withCircuit(this.circuitDefinition.withColumns(newCols)),
            newHand: hand.withHeldGateColumn(grabbedGates, holdOffset)
        };
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
