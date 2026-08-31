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

/**
 * Values used by the various gate drawing strategies.
 *
 * Construct through the named factories below - inCircuit, held - which capture the
 * two places a gate is drawn and hide the defaults each of them implies.
 */
class GateDrawParams {
    /**
     * Prefer the named factories; the positional constructor is their implementation.
     * @param {!Painter} painter
     * @param {!Hand} hand
     * @param {!boolean} isInToolbox
     * @param {!boolean} isHighlighted
     * @param {!boolean} isResizeShowing
     * @param {!boolean} isResizeHighlighted
     * @param {!Rect} rect
     * @param {!Gate} gate
     * @param {!CircuitStats} stats
     * @param {undefined|!{row: !int, col: !int}} positionInCircuit
     * @param {!Array.<!Point>} focusPoints
     * @param {undefined|*} customStatsForCircuitPos
     */
    constructor(painter,
                hand,
                isInToolbox,
                isHighlighted,
                isResizeShowing,
                isResizeHighlighted,
                rect,
                gate,
                stats,
                positionInCircuit,
                focusPoints,
                customStatsForCircuitPos) {
        /** @type {!Painter} */
        this.painter = painter;
        /** @type {!Hand} */
        this.hand = hand;
        /** @type {!boolean} */
        this.isInToolbox = isInToolbox;
        /** @type {!boolean} */
        this.isHighlighted = isHighlighted;
        /** @type {!boolean} */
        this.isResizeShowing = isResizeShowing;
        /** @type {!boolean} */
        this.isResizeHighlighted = isResizeHighlighted;
        /** @type {!Rect} */
        this.rect = rect;
        /** @type {!Gate} */
        this.gate = gate;
        /** @type {!CircuitStats} */
        this.stats = stats;
        /** @type {undefined|!{row: !int, col: !int}} */
        this.positionInCircuit = positionInCircuit;
        /** @type {!Array.<!Point>} */
        this.focusPoints = focusPoints;
        /** @type {undefined|*} */
        this.customStats = customStatsForCircuitPos;
    }

    /**
     * A gate drawn at its slot on the circuit.
     *
     * @param {!Painter} painter
     * @param {!Hand} hand
     * @param {!Rect} rect
     * @param {!Gate} gate
     * @param {!CircuitStats} stats
     * @param {!{row: !int, col: !int}} positionInCircuit
     * @param {!{
     *     isHighlighted: (!boolean|undefined),
     *     isResizeShowing: (!boolean|undefined),
     *     isResizeHighlighted: (!boolean|undefined),
     *     focusPoints: (!Array.<!Point>|undefined),
     *     customStats: (*|undefined)
     * }=} opts
     * @returns {!GateDrawParams}
     */
    static inCircuit(painter, hand, rect, gate, stats, positionInCircuit, opts = {}) {
        return new GateDrawParams(
            painter,
            hand,
            false,
            opts.isHighlighted || false,
            opts.isResizeShowing || false,
            opts.isResizeHighlighted || false,
            rect,
            gate,
            stats,
            positionInCircuit,
            opts.focusPoints || [],
            opts.customStats);
    }

    /**
     * The gate riding the cursor: highlighted, resize tab showing, not yet anywhere.
     *
     * @param {!Painter} painter
     * @param {!Hand} hand
     * @param {!Rect} rect
     * @param {!Gate} gate
     * @param {!CircuitStats} stats
     * @returns {!GateDrawParams}
     */
    static held(painter, hand, rect, gate, stats) {
        return new GateDrawParams(
            painter,
            hand,
            false,
            true,
            true,
            false,
            rect,
            gate,
            stats,
            undefined,
            [],
            undefined);
    }

    /**
     * @param {!string} key
     * @returns {undefined|*}
     */
    getGateContext(key) {
        if (this.positionInCircuit === undefined) {
            return undefined;
        }

        return this.stats.circuitDefinition.
            colCustomContextFromGates(this.positionInCircuit.col, 0).
            get(key);
    }
}

export {GateDrawParams}
