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

import {ObservableValue} from "../base/Obs.js"
import {Simulation} from "../config/Simulation.js"

/**
 * Which point in the circuit the transport controls are parked at, independent of DOM elements.
 *
 * The step counts the columns that have already executed, so it runs from 0 (nothing has run) to
 * the column count (the whole circuit has run). A column is the unit of execution here, which is
 * why stepping moves a column at a time even when the column holds several gates.
 */
class Playhead {
    /**
     * @param {!Observable.<!int>} obsColumnCount The number of columns in the circuit being edited.
     * @param {!OverlayState} overlayState
     * @param {!function(!function(): void, !number): *} setIntervalFunc
     * @param {!function(*): void} clearIntervalFunc
     */
    constructor(obsColumnCount,
                overlayState,
                setIntervalFunc = (callback, delay) => setInterval(callback, delay),
                clearIntervalFunc = timer => clearInterval(timer)) {
        this._setInterval = setIntervalFunc;
        this._clearInterval = clearIntervalFunc;
        this._columnCount = 0;
        this._step = 0;
        this._playing = false;
        this._overlayShowing = false;
        /** @type {undefined|*} */
        this._timer = undefined;
        this._state = new ObservableValue(this._snapshot());

        obsColumnCount.subscribe(columnCount => {
            this._columnCount = Math.max(0, columnCount);
            // Editing the circuit shorter than the playhead pulls the playhead back to the new end,
            // rather than dropping it to the start and losing the user's place.
            this._step = Math.min(this._step, this._columnCount);
            if (this._step >= this._columnCount) {
                this._pause();
            }
            this._publish();
        });

        overlayState.active().map(active => active !== undefined).whenDifferent().subscribe(showing => {
            this._overlayShowing = showing;
            if (showing) {
                this._pause();
            }
            this._publish();
        });
    }

    /**
     * @returns {!{
     *     step: !int,
     *     columnCount: !int,
     *     playing: !boolean,
     *     canPlay: !boolean,
     *     canStepBack: !boolean,
     *     canStepForward: !boolean
     * }}
     * @private
     */
    _snapshot() {
        return {
            step: this._step,
            columnCount: this._columnCount,
            playing: this._playing,
            canPlay: this._columnCount > 0 && !this._overlayShowing,
            canStepBack: this._step > 0 && !this._overlayShowing,
            canStepForward: this._step < this._columnCount && !this._overlayShowing
        };
    }

    /**
     * @private
     */
    _publish() {
        this._state.set(this._snapshot());
    }

    /**
     * @returns {!Observable.<!{
     *     step: !int,
     *     columnCount: !int,
     *     playing: !boolean,
     *     canPlay: !boolean,
     *     canStepBack: !boolean,
     *     canStepForward: !boolean
     * }>}
     */
    state() {
        return this._state.observable();
    }

    /**
     * @returns {!int} The number of columns that have executed at the playhead.
     */
    step() {
        return this._step;
    }

    /**
     * Moves the playhead without touching playback, which is what the play timer wants.
     * @param {!int} step
     * @returns {void}
     * @private
     */
    _seek(step) {
        if (!Number.isFinite(step)) {
            return;
        }
        let clamped = Math.min(Math.max(0, Math.round(step)), this._columnCount);
        if (clamped === this._step) {
            return;
        }
        this._step = clamped;
        if (this._step >= this._columnCount) {
            this._pause();
        }
        this._publish();
    }

    /**
     * Stops playing, if it was.
     * @returns {void}
     */
    pause() {
        if (!this._playing) {
            return;
        }
        this._pause();
        this._publish();
    }

    /**
     * Moving the playhead by hand stops playback, so the two never fight over where it sits.
     * @param {!int} step
     * @returns {void}
     */
    seek(step) {
        this.pause();
        this._seek(step);
    }

    /**
     * @returns {void}
     */
    reset() {
        this.seek(0);
    }

    /**
     * @returns {void}
     */
    previous() {
        this.seek(this._step - 1);
    }

    /**
     * @returns {void}
     */
    next() {
        this.seek(this._step + 1);
    }

    /**
     * @returns {void}
     */
    end() {
        this.seek(this._columnCount);
    }

    /**
     * Starts or stops advancing a column at a time. Playing from the end starts over, so the
     * button never sits enabled with nothing left to do.
     * @returns {void}
     */
    togglePlay() {
        if (this._playing) {
            this._pause();
            this._publish();
            return;
        }
        if (this._columnCount === 0 || this._overlayShowing) {
            return;
        }
        if (this._step >= this._columnCount) {
            this._step = 0;
        }
        this._playing = true;
        this._timer = this._setInterval(() => this._seek(this._step + 1), Simulation.PLAYHEAD_STEP_DURATION_MS);
        this._publish();
    }

    /**
     * @private
     */
    _pause() {
        if (this._timer !== undefined) {
            this._clearInterval(this._timer);
            this._timer = undefined;
        }
        this._playing = false;
    }
}

export {Playhead}
