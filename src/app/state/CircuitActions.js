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

const EMPTY_STATE = '{"cols":[]}';

/**
 * Undo, redo, and circuit-clearing behavior independent of DOM elements.
 */
class CircuitActions {
    /**
     * @param {!Revision} revision
     * @param {!OverlayState} overlayState
     */
    constructor(revision, overlayState) {
        this._revision = revision;
        let obsIsAnyOverlayShowing = overlayState.active().map(active => active !== undefined).whenDifferent();
        this._availability = revision.latestActiveCommit().zipLatest(
            obsIsAnyOverlayShowing,
            (state, overlayShowing) => ({
                canUndo: !revision.isAtBeginningOfHistory() && !overlayShowing,
                canRedo: !revision.isAtEndOfHistory() && !overlayShowing,
                canClearCircuit: state !== _emptyCircuitState(state) && !overlayShowing,
                canClearAll: state !== EMPTY_STATE && !overlayShowing
            }));
    }

    /**
     * @returns {!Observable.<{
     *     canUndo: boolean,
     *     canRedo: boolean,
     *     canClearCircuit: boolean,
     *     canClearAll: boolean
     * }>}
     */
    availability() {
        return this._availability;
    }

    /**
     * @returns {undefined|*}
     */
    undo() {
        return this._revision.undo();
    }

    /**
     * @returns {undefined|*}
     */
    redo() {
        return this._revision.redo();
    }

    /**
     * Clears the circuit while preserving custom gates.
     * @returns {void}
     */
    clearCircuit() {
        this._revision.commit(_emptyCircuitState(this._revision.peekActiveCommit()));
    }

    /**
     * Clears the circuit and custom gates.
     * @returns {void}
     */
    clearAll() {
        this._revision.commit(EMPTY_STATE);
    }
}

/**
 * Returns the current state without its circuit while preserving custom gates.
 * @param {!string} state
 * @returns {!string}
 */
function _emptyCircuitState(state) {
    let value = JSON.parse(state);
    value.cols = [];
    return JSON.stringify(value);
}

export {CircuitActions}
