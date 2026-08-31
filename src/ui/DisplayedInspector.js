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
import {Typography} from "../config/Typography.js"
import {DisplayedCircuit} from "../ui/DisplayedCircuit.js"
import {GateDrawParams} from "../draw/GateDrawParams.js"
import {GatePainting} from "../draw/GatePainting.js"
import {Hand} from "../ui/Hand.js"
import {Painter} from "../draw/Painter.js"
import {Rect} from "../math/Rect.js"
import {Serializer} from "../circuit/Serializer.js"

/**
 * How far above the circuit the hint doodles anchor their frame. Their arrows were drawn to reach
 * the circuit's top edge from here.
 * @type {!number}
 */
const HINT_FRAME_OFFSET = 125;

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
        this._drawHint(painter);
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

    _drawHint(painter) {
        // The hints are hand-placed doodles. They were laid out against a frame whose origin sat
        // HINT_FRAME_OFFSET above the circuit, so the frame moves with the circuit and they keep
        // pointing where they always did.
        painter.ctx.save();
        painter.ctx.translate(0, this.displayedCircuit.top - HINT_FRAME_OFFSET);
        this._drawHint_watchOutputsChange(painter);
        this._drawHint_useControls(painter);
        painter.ctx.restore();
    }

    /**
     * @param {!Painter} painter
     * @private
     */
    _drawHint_watchOutputsChange(painter) {
        let visibilityFactor = this._hintVisibility();
        if (visibilityFactor <= 0) {
            return;
        }

        painter.ctx.save();
        painter.ctx.globalAlpha *= Math.min(1, visibilityFactor);
        // Anchored to the first output display column so the arrow follows the right-aligned displays.
        painter.ctx.translate(
            this.displayedCircuit.opRect(this.displayedCircuit.clampedCircuitColCount() + 1).x - 330, 15);

        painter.ctx.save();
        painter.ctx.translate(268, 250);
        painter.ctx.rotate(Math.PI * 0.02);
        painter.ctx.fillStyle = Palette.ERROR_COLOR;
        painter.ctx.textAlign = 'right';
        painter.ctx.font = `16px ${Typography.DEFAULT_FONT_FAMILY}`;
        painter.ctx.fillText("outputs change", 0, 0);
        painter.ctx.restore();

        painter.ctx.beginPath();
        painter.ctx.moveTo(270, 245);
        painter.ctx.bezierCurveTo(
            300, 245,
            315, 235,
            325, 225);
        painter.ctx.strokeStyle = Palette.ERROR_COLOR;
        painter.ctx.lineWidth = 3;
        painter.ctx.stroke();

        painter.trace(tracer => {
            tracer.arrowHead(330, 219, 10, Math.PI*-0.265, 1.3);
        }).thenFill(Palette.ERROR_COLOR);

        painter.ctx.restore();
    }

    _hintVisibility() {
        if (this.displayedCircuit.circuitDefinition.columns.length > 0) {
            return 0;
        }
        return this.hand.pos === undefined || !this.hand.isBusy() ? 1.0 :
            this.hand.heldGate !== undefined && this.hand.heldGate.isControl() ? 1.0 :
            (this.displayedCircuit.top + 2 - this.hand.pos.y)/50;
    }



    /**
     * @param {!Painter} painter
     * @private
     */
    _drawHint_useControls(painter) {
        let visibilityFactor = this._hintVisibility();
        if (visibilityFactor <= 0) {
            return;
        }
        painter.ctx.save();
        painter.ctx.globalAlpha *= Math.min(1, visibilityFactor);

        let firstSlotAvailable = this.displayedCircuit.circuitDefinition.gateInSlot(0, 0) === undefined;
        let fy = firstSlotAvailable ? 173 : 223;

        painter.ctx.save();
        painter.ctx.translate(70, fy-3);
        painter.ctx.rotate(Math.PI * -0.01);
        painter.ctx.fillStyle = Palette.ERROR_COLOR;
        painter.ctx.font = `16px ${Typography.DEFAULT_FONT_FAMILY}`;
        painter.ctx.fillText("use controls", 0, 0);
        painter.ctx.restore();

        painter.ctx.beginPath();
        if (firstSlotAvailable) {
            painter.ctx.moveTo(90, 125);
            painter.ctx.bezierCurveTo(
                60, 140,
                48, 160,
                55, fy);
        } else {
            painter.ctx.moveTo(100, 125);
            painter.ctx.bezierCurveTo(
                115, 150,
                105, 170,
                55, fy);
        }
        painter.ctx.strokeStyle = Palette.ERROR_COLOR;
        painter.ctx.lineWidth = 3;
        painter.ctx.stroke();
        painter.ctx.beginPath();
        painter.ctx.arc(55, fy, 5, 0, 2 * Math.PI);
        painter.ctx.fillStyle = Palette.ERROR_COLOR;
        painter.ctx.fill();

        painter.ctx.restore();
    }
}

export {DisplayedInspector}
