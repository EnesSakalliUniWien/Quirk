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

import {CircuitDefinition} from "../circuit/CircuitDefinition.js"
import {CircuitStats} from "../circuit/CircuitStats.js"
import {Layout} from "../config/Layout.js"
import {Palette} from "../config/Palette.js"
import {DisplayedCircuit} from "../ui/DisplayedCircuit.js"
import {GateDrawParams} from "../draw/GateDrawParams.js"
import {GatePainting} from "../draw/GatePainting.js"
import {Hand} from "../ui/Hand.js"
import {Painter} from "../draw/Painter.js"
import {Rect} from "../math/Rect.js"
import {Serializer} from "../circuit/Serializer.js"

class DisplayedInspector {
    /**
     * @param {!Rect} drawArea
     * @param {!DisplayedCircuit} circuitWidget
     * @param {!Hand} hand
     */
    constructor(drawArea, circuitWidget, hand) {
        /** @type {!DisplayedCircuit} */
        this.displayedCircuit = circuitWidget;
        /** @type {!Hand} */
        this.hand = hand;
        /** @type {!Rect} */
        this.drawArea = new Rect(0, 0, 0, 0);

        this.updateArea(drawArea);
    }

    desiredWidth() {
        return this.displayedCircuit.desiredWidth();
    }

    /**
     * @param {!Rect} drawArea
     */
    updateArea(drawArea) {
        this.drawArea = drawArea;

        this.displayedCircuit = this.displayedCircuit.withTop(Layout.CIRCUIT_TOP_MARGIN);
        this.displayedCircuit.updateDisplayShift(drawArea.w);
    }

    /**
     * @param {!Rect} drawArea
     * @returns {!DisplayedInspector}
     */
    static empty(drawArea) {
        return new DisplayedInspector(
            drawArea,
            DisplayedCircuit.empty(Layout.CIRCUIT_TOP_MARGIN),
            Hand.EMPTY);
    }

    /**
     * @param {!Painter} painter
     * @param {!CircuitStats} stats
     * @param {undefined|!int} playheadStep The number of columns that have executed at the playhead.
     */
    paint(painter, stats, playheadStep=undefined) {
        painter.fillRect(this.drawArea, Palette.BACKGROUND_COLOR);

        this.displayedCircuit.paint(painter, this.hand, stats, false, true, playheadStep);
        this._paintHand(painter, stats);
    }

    /**
     * @param {!Painter} painter
     * @param {!CircuitStats} stats
     * @private
     */
    _paintHand(painter, stats) {
        if (this.hand.pos === undefined || this.hand.heldGate === undefined) {
            return;
        }

        let gate = this.hand.heldGate;
        let pos = this.hand.pos.minus(this.hand.holdOffset);
        let rect = new Rect(
            Math.round(pos.x - 0.5) + 0.5,
            Math.round(pos.y - 0.5) + 0.5,
            Layout.GATE_RADIUS*2 + Layout.WIRE_SPACING*(gate.width-1),
            Layout.GATE_RADIUS*2 + Layout.WIRE_SPACING*(gate.height-1));
        let drawer = gate.customDrawer || GatePainting.DEFAULT_DRAWER;
        drawer(GateDrawParams.held(painter, this.hand, rect, gate, stats));
    }

    /**
     * @returns {undefined|!string}
     */
    tryGetHandOverButtonKey() {
        if (this.hand.pos === undefined) {
            return undefined;
        }
        let butBos = this.displayedCircuit.findGateWithButtonContaining(this.hand.pos);
        if (butBos !== undefined) {
            return `gate-button-${butBos.col}:${butBos.row}`;
        }
        let initPos = this.displayedCircuit.findWireWithInitialStateAreaContaining(this.hand.pos);
        if (initPos !== undefined) {
            return `wire-init-${initPos}`;
        }
        return undefined;
    }

    /**
     * @returns {undefined|!DisplayedInspector}
     */
    tryClick() {
        let newDisplayedCircuit = this.displayedCircuit.tryClick(this.hand);
        return newDisplayedCircuit === undefined ? undefined : this.withDisplayedCircuit(newDisplayedCircuit);
    }

    /**
     * @param {!boolean=false} duplicate
     * @param {!boolean=false} wholeCol
     * @param {!boolean=false} ignoreResizeTabs
     * @param {!boolean=false} alt
     * @returns {!DisplayedInspector}
     */
    afterGrabbing(duplicate=false, wholeCol=false, ignoreResizeTabs=false, alt=false) {
        let hand = this.hand;
        let circuit = this.displayedCircuit;

        let obj = circuit.tryGrab(hand, duplicate, wholeCol, ignoreResizeTabs, alt);
        hand = obj.newHand;
        circuit = obj.newCircuit;

        return new DisplayedInspector(this.drawArea, circuit, hand);
    }

    /**
     * @param {!DisplayedInspector|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        if (this === other) {
            return true;
        }
        //noinspection JSUnresolvedVariable
        return other instanceof DisplayedInspector &&
            this.drawArea.isEqualTo(other.drawArea) &&
            this.displayedCircuit.isEqualTo(other.displayedCircuit) &&
            this.hand.isEqualTo(other.hand);
    }

    /**
     * @param {!DisplayedCircuit} displayedCircuit
     * @returns {!DisplayedInspector}
     */
    withDisplayedCircuit(displayedCircuit) {
        if (displayedCircuit === this.displayedCircuit) {
            return this;
        }
        return new DisplayedInspector(this.drawArea, displayedCircuit, this.hand);
    }

    /**
     * @param {!Hand} hand
     * @param {!int} extraWires
     * @returns {!DisplayedInspector}
     */
    withJustEnoughWires(hand, extraWires) {
        return this.withDisplayedCircuit(this.displayedCircuit.withJustEnoughWires(hand, extraWires));
    }

    /**
    * @returns {!DisplayedInspector}
    */
    afterTidyingUp() {
        return this.withDisplayedCircuit(this.displayedCircuit.afterTidyingUp());
    }

    /**
     * @returns {!DisplayedInspector}
     */
    previewDrop() {
        if (!this.hand.isBusy()) {
            return this;
        }

        let hand = this.hand;
        let circuitWidget = this.displayedCircuit;
        let previewCircuit = circuitWidget.previewDrop(hand);
        let previewHand = previewCircuit === circuitWidget ? hand : hand.withDrop();
        return this.withHand(previewHand).withDisplayedCircuit(previewCircuit);
    }

    /**
     * @returns {!DisplayedInspector}
     */
    afterDropping() {
        return this.
            withDisplayedCircuit(this.displayedCircuit.afterDropping(this.hand)).
            withHand(this.hand.withDrop());
    }

    /**
     * @returns {Infinity|!number}
     */
    stableDuration() {
        return Math.min(this.hand.stableDuration(), this.displayedCircuit.stableDuration());
    }

    /**
     * @param {!Hand} hand
     * @returns {!DisplayedInspector}
     */
    withHand(hand) {
        return new DisplayedInspector(this.drawArea, this.displayedCircuit, hand);
    }

    /**
     * @param {!CircuitDefinition} newCircuitDefinition
     * @returns {!DisplayedInspector}
     */
    withCircuitDefinition(newCircuitDefinition) {
        return new DisplayedInspector(
            this.drawArea,
            DisplayedCircuit.empty(Layout.CIRCUIT_TOP_MARGIN).withCircuit(newCircuitDefinition),
            this.hand.withDrop());
    }

    /**
     * @returns {!number}
     */
    desiredHeight() {
        return Math.max(
            Layout.MINIMUM_CANVAS_HEIGHT,
            Layout.CIRCUIT_TOP_MARGIN + this.displayedCircuit.desiredHeight());
    }

    /**
     * @returns {!string}
     */
    snapshot() {
        return JSON.stringify(Serializer.toJson(this.displayedCircuit.circuitDefinition), null, 0);
    }
}

export {DisplayedInspector}
