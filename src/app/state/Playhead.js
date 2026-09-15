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

import {createValueStore, observeStore} from '../../base/valueStore.js';
import {Playback} from "../../config/Playback.js"

/**
 * Which point in the circuit the transport controls are parked at, independent of DOM elements.
 *
 * The step counts the columns that have already executed, so it runs from 0 (nothing has run) to
 * the column count (the whole circuit has run). A column is the unit of execution here, which is
 * why gates in one column execute together. Transport stops skip columns without operations.
 */
class Playhead {
    /**
     * @param {!Observable.<!{columnCount: number, operationColumns: number[]}>} obsSchedule
     * @param {!function(!function(): void, !number): *} setIntervalFunc
     * @param {!function(*): void} clearIntervalFunc
     */
    constructor(obsSchedule,
                setIntervalFunc = (callback, delay) => setInterval(callback, delay),
                clearIntervalFunc = timer => clearInterval(timer)) {
        this._setInterval = setIntervalFunc;
        this._clearInterval = clearIntervalFunc;
        this._columnCount = 0;
        this._operationColumns = [];
        this._step = 0;
        this._playing = false;
        this.generation = 0;
        this._restartOnPlay = true;
        /** @type {undefined|*} */
        this._timer = undefined;
        this._state = createValueStore(this._snapshot());

        obsSchedule.subscribe(({columnCount, operationColumns}) => {
            this._columnCount = Math.max(0, columnCount);
            this._operationColumns = operationColumns;
            // Editing the circuit shorter than the playhead pulls the playhead back to the new end,
            // rather than dropping it to the start and losing the user's place.
            this._step = Math.min(this._step, this._columnCount);
            if (!this._operationColumns.some(col => col >= this._step)) {
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
            operationIndex: this._operationColumns.filter(col => col < this._step).length,
            operationCount: this._operationColumns.length,
            playing: this._playing,
            canPlay: this._operationColumns.length > 0,
            canStepBack: this._step > 0,
            canStepForward: this._operationColumns.some(col => col >= this._step)
        };
    }

    /**
     * @private
     */
    _publish() {
        this._state.setState({value: this._snapshot()});
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
        return observeStore(this._state);
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
        const clamped = Math.min(Math.max(0, Math.round(step)), this._columnCount);
        if (clamped === this._step) {
            return;
        }
        this._step = clamped;
        if (!this._operationColumns.some(col => col >= this._step)) {
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
        if (step <= 0) this._restartOnPlay = true;
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
        this.seek(this._stops().findLast(step => step < this._step) ?? 0);
    }

    /**
     * @returns {void}
     */
    next() {
        this.seek(this._nextStep());
    }

    /** Simulation column boundaries after each operation; the final stop includes trailing displays. */
    _stops() {
        return [0, ...this._operationColumns.map((col, index) =>
            index === this._operationColumns.length - 1 ? this._columnCount : col + 1)];
    }

    _nextStep() {
        return this._stops().find(step => step > this._step) ?? this._columnCount;
    }

    /** Scrub by operation number without changing the raw-column seek API used by Tape and panels. */
    seekOperation(index) {
        if (!Number.isFinite(index)) return;
        this.seek(this._stops()[Math.min(this._operationColumns.length, Math.max(0, Math.round(index)))]);
    }

    /**
     * @returns {void}
     */
    end() {
        this.seek(this._columnCount);
    }

    /**
     * Starts or stops advancing an operation column at a time. Playing from the end starts over, so the
     * button never sits enabled with nothing left to do.
     * @returns {void}
     */
    togglePlay() {
        if (this._playing) {
            this._pause();
            this._publish();
            return;
        }
        if (this._operationColumns.length === 0) {
            return;
        }
        if (!this._operationColumns.some(col => col >= this._step)) {
            this._step = 0;
            this._restartOnPlay = true;
        }
        if (this._step === 0 && this._restartOnPlay) this.generation++;
        this._restartOnPlay = false;
        this._playing = true;
        this._timer = this._setInterval(() => this._seek(this._nextStep()), Playback.PLAYHEAD_STEP_DURATION_MS);
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
