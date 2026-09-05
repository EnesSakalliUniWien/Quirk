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

import {DetailedError} from "../base/DetailedError.js"
import {Layout} from "../config/Layout.js"
import {Rect} from "../math/Rect.js"
import {Simulation} from "../config/Simulation.js"
import {
    CIRCUIT_OP_HORIZONTAL_SPACING,
    CIRCUIT_OP_LEFT_SPACING,
    CIRCUIT_RIGHT_MARGIN,
    CIRCUIT_BOTTOM_MARGIN,
} from "./CircuitLayoutConstants.js"

/** The chance and Bloch columns drawn after the circuit's last column. */
const EXTRA_COLS_FOR_SINGLE_QUBIT_DISPLAYS = 2;

/**
 * Where everything on a drawn circuit is: wires, columns, gates, and the output displays.
 *
 * Built from the five facts that determine every rect, so painting and hit testing can share one
 * answer to "where is that?" without reaching into the circuit widget's private state. Immutable;
 * DisplayedCircuit derives a fresh one whenever any of the facts changes.
 */
class CircuitGeometry {
    /**
     * @param {!number} top
     * @param {!CircuitDefinition} circuitDefinition
     * @param {undefined|!int} compressedColumnIndex The column pinched shut mid-drag, if any.
     * @param {undefined|!int} extraWireStartIndex Where the temporary drag wire starts, if any.
     * @param {!number} displayShift How far right the output displays are pushed so they end at
     *     the right edge of the available area.
     */
    constructor(top, circuitDefinition, compressedColumnIndex, extraWireStartIndex, displayShift) {
        /** @type {!number} */
        this.top = top;
        /** @type {!CircuitDefinition} */
        this.circuitDefinition = circuitDefinition;
        /** @type {undefined|!int} */
        this.compressedColumnIndex = compressedColumnIndex;
        /** @type {undefined|!int} */
        this.extraWireStartIndex = extraWireStartIndex;
        /** @type {!number} */
        this.displayShift = displayShift;
    }

    /**
     * The number of wires that were in the circuit before picking up a gate, or the number that
     * will be in the circuit after dropping a gate; whichever is larger.
     * @returns {!int}
     */
    groundedWireCount() {
        let pseudoCount =
            this.extraWireStartIndex !== undefined && this.extraWireStartIndex !== Simulation.MAX_WIRE_COUNT ? 1 : 0;

        let n = Math.max(Simulation.MIN_WIRE_COUNT, this.circuitDefinition.numWires) - pseudoCount;
        return Math.max(n, this.circuitDefinition.minimumRequiredWireCount());
    }

    /**
     * @returns {!int}
     */
    importantWireCount() {
        return Math.max(
            this.circuitDefinition.numWires - (this.extraWireStartIndex === Simulation.MAX_WIRE_COUNT ? 0 : 1),
            Simulation.MIN_WIRE_COUNT,
            this.circuitDefinition.minimumRequiredWireCount());
    }

    /**
     * @returns {!number} The number of columns used for drawing the circuit, before the output display.
     */
    clampedCircuitColCount() {
        return Math.max(
            this.circuitDefinition.columns.length,
            Simulation.MIN_COL_COUNT + (this.compressedColumnIndex !== undefined ? 1 : 0));
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
     * @param {!boolean=true} forTooltip
     * @returns {!number}
     */
    desiredHeight(forTooltip=false) {
        if (forTooltip) {
            return this.circuitDefinition.numWires * Layout.WIRE_SPACING;
        }
        // The superposition grid's bottom edge lines up with the last wire's gate rect; the labels
        // and warnings drawn under it need the bottom margin.
        let n = this.groundedWireCount();
        let gridBottom = (n - 1) * Layout.WIRE_SPACING + Layout.WIRE_SPACING / 2 + Layout.GATE_RADIUS;
        return gridBottom + CIRCUIT_BOTTOM_MARGIN;
    }

    /**
     * @param {!boolean=true} forTooltip
     * @returns {!number}
     */
    desiredWidth(forTooltip=false) {
        if (forTooltip) {
            return this.opRect(this.circuitDefinition.columns.length - 1).right() + CIRCUIT_OP_LEFT_SPACING;
        }
        // The grid's row labels and captions draw right of it, inside the right margin.
        return this.rectForSuperpositionDisplay().right() + CIRCUIT_RIGHT_MARGIN;
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
        if (this.compressedColumnIndex !== undefined && operationIndex === this.compressedColumnIndex) {
            tweak = opSeparation / 2;
        }
        if (this.compressedColumnIndex !== undefined && operationIndex > this.compressedColumnIndex) {
            tweak = opSeparation;
        }

        let dx = opSeparation * operationIndex - tweak + CIRCUIT_OP_LEFT_SPACING;
        if (this._isOutputDisplayColumn(operationIndex)) {
            dx += this.displayShift;
        }
        return new Rect(dx, this.top, opWidth, this.desiredHeight());
    }

    /**
     * @param {!int} wireIndex
     * @param {!int} operationIndex
     * @param {!int=} width
     * @param {!int=} height
     * @returns {!Rect}
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
     * @returns {!Rect} Where the output superposition grid is drawn.
     */
    rectForSuperpositionDisplay() {
        let col = this.clampedCircuitColCount() + EXTRA_COLS_FOR_SINGLE_QUBIT_DISPLAYS + 1;
        let numWire = this.importantWireCount();
        let [colWires, rowWires] = [Math.floor(numWire/2), Math.ceil(numWire/2)];
        let [colCount, rowCount] = [1 << colWires, 1 << rowWires];
        let topRect = this.gateRect(0, col);
        let bottomRect = this.gateRect(numWire-1, col);
        let gridRect = new Rect(topRect.x, topRect.y, 0, bottomRect.bottom() - topRect.y);
        return gridRect.withW(gridRect.h * (colCount/rowCount));
    }
}

export {CircuitGeometry}
