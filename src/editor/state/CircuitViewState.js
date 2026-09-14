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

import {findGateOverlappingPos, findWireWithInitialStateAreaContaining, indexOfDisplayedRowAt} from '../interaction/CircuitHitTesting.js';
import {highlightStatusAt} from '../interaction/CircuitHighlightStatus.js';
import {tidyCircuit, afterDropping, previewDrop, tryClick, tryGrab, withJustEnoughWires} from '../editing/CircuitEditing.js';

import {CircuitDefinition} from '../../circuit/model/CircuitDefinition.js';
import {geometryForCircuit} from '../geometry/CircuitLayout.js';
import {Simulation} from '../../config/Simulation.js';

import {DetailedError} from '../../base/DetailedError.js';
import {equate} from '../../base/Equate.js';

/** Immutable circuit view state and editing entry points. */
class CircuitViewState {
    /**
     *
     * @param {!number} top
     * @param {!CircuitDefinition} circuitDefinition
     * @param {undefined|!int} compressedColumnIndex
     * @param {undefined|!{col: !int, row: undefined|!int, resizeStyle: !boolean}} highlightedSlot
     * @param {undefined|!int} extraWireStartIndex
     * @param {!number} availableWidth
     * @private
     */
    constructor(top, circuitDefinition, compressedColumnIndex, highlightedSlot, extraWireStartIndex, availableWidth=0) {
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
        this._highlightedSlot = highlightedSlot === undefined ? undefined : Object.freeze({...highlightedSlot});
        /**
         * @type {undefined|!int}
         * @private
         */
        this._extraWireStartIndex = extraWireStartIndex;
        /** Available layout width; excluded from circuit equality, like the former display shift. */
        this._availableWidth = availableWidth;
        Object.freeze(this);
    }

    /** Geometry is derived and cached outside this immutable display snapshot. */
    geometry() {
        return geometryForCircuit(this);
    }

    /** A single layout update preserves identity when pointer-only changes leave layout unchanged. */
    withLayout(top, availableWidth) {
        return this.top === top && this._availableWidth === availableWidth ? this :
            new CircuitViewState(top, this.circuitDefinition, this._compressedColumnIndex,
                this._highlightedSlot, this._extraWireStartIndex, availableWidth);
    }

    /** Applies one editing result; an omitted marker is preserved and undefined clears it. */
    withEdit(edit) {
        if (edit === undefined) return this;
        const value = (key, previous) => Object.hasOwn(edit, key) ? edit[key] : previous;
        const definition = edit.definition ?? this.circuitDefinition;
        const compressed = value('compressedColumnIndex', this._compressedColumnIndex);
        const highlighted = value('highlightedSlot', this._highlightedSlot);
        const extra = value('extraWireStartIndex', this._extraWireStartIndex);
        if (definition === this.circuitDefinition && compressed === this._compressedColumnIndex &&
            equate(highlighted, this._highlightedSlot) && extra === this._extraWireStartIndex) return this;
        return new CircuitViewState(this.top, definition, compressed, highlighted, extra);
    }

    /** Returns a new layout snapshot; existing geometry and snapshots remain unchanged. */
    withAvailableWidth(availableWidth) {
        return new CircuitViewState(this.top, this.circuitDefinition,
            this._compressedColumnIndex, this._highlightedSlot, this._extraWireStartIndex, availableWidth);
    }

    /**
     * @returns {!number} The width the drawn circuit needs on its own, before the output displays
     *     are pushed to the right edge of the available area.
     */
    unshiftedDesiredWidth() {
        return this.desiredWidth() - this.geometry().displayShift;
    }

    /**
     * @param {!number} top
     * @returns {!CircuitViewState}
     */
    static empty(top) {
        return new CircuitViewState(
            top,
            new CircuitDefinition(Simulation.MIN_WIRE_COUNT, []),
            undefined,
            undefined,
            undefined);
    }

    /**
     * @param {!number} top
     * @returns {!CircuitViewState}
     */
    withTop(top) {
        return new CircuitViewState(
            top,
            this.circuitDefinition,
            this._compressedColumnIndex,
            this._highlightedSlot,
            this._extraWireStartIndex);
    }

    /**
     * @param {!boolean=false} forTooltip
     * @returns {!number}
     */
    desiredHeight(forTooltip=false) {
        return this.geometry().desiredHeight(forTooltip);
    }

    /**
     * @param {!boolean=true} forTooltip
     * @returns {!number}
     */
    desiredWidth(forTooltip=false) {
        return this.geometry().desiredWidth(forTooltip);
    }

    /**
     * @param {!int} wireIndex
     * @returns {!Rect}
     */
    wireRect(wireIndex) {
        return this.geometry().wireRect(wireIndex);
    }

    /**
     * @param {!int} operationIndex
     * @returns {Rect!}
     */
    opRect(operationIndex) {
        return this.geometry().opRect(operationIndex);
    }

    /**
     * @param {!int} wireIndex
     * @param {!int} operationIndex
     * @param {!int=} width
     * @param {!int=} height
     * @returns {!Rect}
     */
    gateRect(wireIndex, operationIndex, width=1, height=1) {
        return this.geometry().gateRect(wireIndex, operationIndex, width, height);
    }

    /**
     * @returns {undefined|!{col: !int, row: undefined|!int, resizeStyle: !boolean}} The slot whose
     *     gate or resize tab the current drag highlights.
     */
    get highlightedSlot() {
        return this._highlightedSlot;
    }

    /**
     * The hover and resize-tab state of the gate in a slot, for the pointer's focus points.
     * @param {!int} col
     * @param {!int} row
     * @param {!Array.<!Point>} focusPoints
     * @returns {!{isResizeShowing: !boolean, isResizeHighlighted: !boolean, isHighlighted: !boolean}}
     */
    highlightStatusAt(col, row, focusPoints) {
        return highlightStatusAt({
            definition: this.circuitDefinition,
            geometry: this.geometry(),
            highlightedSlot: this._highlightedSlot,
            findGateAt: pos => findGateOverlappingPos(this.geometry(), pos),
        }, col, row, focusPoints);
    }

    /**
     * @returns {!CircuitViewState}
     */
    afterTidyingUp() { return tidyCircuit(this); }

    /**
     * @param {!number} y
     * @returns {undefined|!int}
     */
    indexOfDisplayedRowAt(y) {
        return indexOfDisplayedRowAt(this.geometry(), y);
    }

    /**
     * @param {!Point} pt
     * @returns {undefined|!int}
     */
    findWireWithInitialStateAreaContaining(pt) {
        return findWireWithInitialStateAreaContaining(this.geometry(), pt);
    }

    /**
     * @param {!CircuitViewState|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        if (this === other) {
            return true;
        }
        return other instanceof CircuitViewState &&
            this.top === other.top &&
            this.circuitDefinition.isEqualTo(other.circuitDefinition) &&
            this._compressedColumnIndex === other._compressedColumnIndex &&
            this._extraWireStartIndex === other._extraWireStartIndex &&
            equate(this._highlightedSlot, other._highlightedSlot);
    }

    /**
     * @param {!PointerInteractionState} hand
     * @returns {!CircuitViewState}
     */
    previewDrop(hand) {
        return previewDrop(this, hand);
    }

    /**
     * @param {!PointerInteractionState} hand
     * @returns {!CircuitViewState}
     */
    afterDropping(hand) {
        return afterDropping(this, hand);
    }

    /**
     * @param {!CircuitDefinition} circuitDefinition
     * @returns {!CircuitViewState}
     */
    withCircuit(circuitDefinition) {
        return new CircuitViewState(
            this.top,
            circuitDefinition,
            this._compressedColumnIndex,
            this._highlightedSlot,
            this._extraWireStartIndex);
    }

    /**
     * @param {undefined|!int} compressedColumnIndex
     * @returns {!CircuitViewState}
     * @private
     */
    _withCompressedColumnIndex(compressedColumnIndex) {
        return new CircuitViewState(
            this.top,
            this.circuitDefinition,
            compressedColumnIndex,
            this._highlightedSlot,
            this._extraWireStartIndex);
    }

    /**
     * @param {undefined|!{col: undefined|!int, row: undefined|!int, resizeStyle: !boolean}} slot
     * @returns {!CircuitViewState}
     * @private
     */
    _withHighlightedSlot(slot) {
        return new CircuitViewState(
            this.top,
            this.circuitDefinition,
            this._compressedColumnIndex,
            slot,
            this._extraWireStartIndex);
    }

    /**
     * @param {undefined|!int} extraWireStartIndex
     * @returns {!CircuitViewState}
     * @private
     */
    _withExtraWireStartIndex(extraWireStartIndex) {
        return new CircuitViewState(
            this.top,
            this.circuitDefinition,
            this._compressedColumnIndex,
            this._highlightedSlot,
            extraWireStartIndex);
    }

    /**
     * @param {!int} extraWireCount
     * @returns {!CircuitViewState}
     */
    withJustEnoughWires(extraWireCount) {
        return withJustEnoughWires(this, extraWireCount);
    }

    /**
     * @param {!PointerInteractionState} hand
     * @returns {undefined|!CircuitViewState}
     */
    tryClick(hand) {
        return tryClick(this, hand);
    }

    /**
     * @param {!PointerInteractionState} hand
     * @param {!boolean=false} duplicate
     * @param {!boolean=false} wholeColumn
     * @param {!boolean=false} ignoreResizeTabs
     * @param {!boolean=false} alt Whether or not to replace grabbed gates with their alternates.
     * @returns {!{newCircuit: !CircuitViewState, newHand: !PointerInteractionState}}
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
        return this.geometry().importantWireCount();
    }

    /**
     * @returns {!number} The number of columns used for drawing the circuit, before the output display.
     */
    clampedCircuitColCount() {
        return this.geometry().clampedCircuitColCount();
    }

}

export {CircuitViewState};
