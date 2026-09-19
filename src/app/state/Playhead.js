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

import {clock} from '../../base/Clock.js';
import {createValueStore, observeStore} from '../../base/valueStore.js';
import {alignColumns} from '../../circuit/columnAlignment.js';
import {Animation} from "../../config/Animation.js"

/**
 * Which point in the circuit the transport controls are parked at, independent of DOM elements.
 *
 * The step counts the columns that have already executed, so it runs from 0 (nothing has run) to
 * the column count (the whole circuit has run). A column is the unit of execution here, which is
 * why gates in one column execute together. Transport stops skip columns without operations.
 */
class Playhead {
    /**
     * @param {!Observable.<!{columnCount: number, operationColumns: number[], columns: (undefined|!Array.<!GateColumn>)}>}
     *     obsSchedule The columns are optional; without them breakpoints stay where they were.
     * @param {!function(!function(): void, !number): *} setIntervalFunc
     * @param {!function(*): void} clearIntervalFunc
     */
    constructor(obsSchedule,
                setIntervalFunc = (callback, delay) => clock.every(delay, callback),
                clearIntervalFunc = stop => stop()) {
        this._setInterval = setIntervalFunc;
        this._clearInterval = clearIntervalFunc;
        this._columnCount = 0;
        this._operationColumns = [];
        this._step = 0;
        /**
         * The operations the transport has stepped over, forwards less backwards. An edit that moves
         * the playhead is not a step, and does not count.
         * @type {!int}
         * @private
         */
        this._operationsStepped = 0;
        /**
         * The columns a run halts before: the user's breakpoints, and whatever else halts a run - the
         * assertions that fail, which whoever evaluates them reports through setHaltColumns.
         * @type {!Array.<!int>}
         * @private
         */
        this._breakpoints = [];
        /** @type {!Array.<!int>} @private */
        this._haltColumns = [];
        /** @type {undefined|!Array.<!GateColumn>} @private */
        this._columns = undefined;
        this._playing = false;
        this.generation = 0;
        this._restartOnPlay = true;
        /** @type {undefined|*} */
        this._timer = undefined;
        this._state = createValueStore(this._snapshot());

        obsSchedule.subscribe(({columnCount, operationColumns, columns}) => {
            // Breakpoints follow their columns through an edit, the way a debugger's follow the
            // lines of an edited file; one whose column went goes with it.
            if (this._columns !== undefined && columns !== undefined) {
                const moved = alignColumns(this._columns, columns);
                this._breakpoints = this._breakpoints.flatMap(col => moved.has(col) ? [moved.get(col)] : []);
            }
            this._columns = columns;
            this._columnCount = Math.max(0, columnCount);
            this._operationColumns = operationColumns;
            // Editing the circuit shorter than the playhead pulls the playhead back to the new end,
            // rather than dropping it to the start and losing the user's place.
            this._step = Math.min(this._step, this._columnCount);
            this._breakpoints = this._breakpoints.filter(col => operationColumns.includes(col));
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
            breakpoints: this._breakpoints,
            nextColumn: this._operationColumns.find(col => col >= this._step),
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
     * @returns {!int} The operations the transport has stepped over so far, forwards less backwards.
     *     Whoever follows the steps - the animation, while it is stopped - reads how far it moved.
     */
    operationsStepped() {
        return this._operationsStepped;
    }

    /**
     * @param {!int} step
     * @returns {void}
     * @private
     */
    _stepTo(step) {
        const operationsBefore = at => this._operationColumns.filter(col => col < at).length;
        this._operationsStepped += operationsBefore(step) - operationsBefore(this._step);
        this._step = step;
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
        this._stepTo(clamped);
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
     * Runs to the end, or to the first breakpoint or halt column on the way: a debugger's continue.
     * @returns {void}
     */
    end() {
        this.seek(this._runTarget(this._columnCount));
    }

    /**
     * Sets or clears the breakpoint on an operation column. A run - Play, or End - halts before a
     * column with a breakpoint; a single step does not care.
     * @param {!int} column
     * @returns {void}
     */
    toggleBreakpoint(column) {
        if (!this._operationColumns.includes(column)) return;
        this._breakpoints = this._breakpoints.includes(column) ?
            this._breakpoints.filter(col => col !== column) :
            [...this._breakpoints, column].sort((a, b) => a - b);
        this._publish();
    }

    /**
     * Replaces the breakpoints, keeping the columns that hold an operation: a link brings its own.
     * @param {!Array.<!int>} columns
     * @returns {void}
     */
    setBreakpoints(columns) {
        this._breakpoints = [...new Set(columns)].
            filter(col => this._operationColumns.includes(col)).
            sort((a, b) => a - b);
        this._publish();
    }

    /**
     * @returns {!Array.<!int>} The columns with a breakpoint, in order.
     */
    breakpoints() {
        return this._breakpoints;
    }

    /**
     * The other columns a run halts before, of any kind: a failing assertion's, for one.
     * @param {!Array.<!int>} columns
     * @returns {void}
     */
    setHaltColumns(columns) {
        this._haltColumns = columns;
    }

    /**
     * @returns {!Array.<!int>} The steps that stand before a breakpoint or a halt column: every
     *     operation left of the column has run, and none from it on.
     * @private
     */
    _haltSteps() {
        const stops = this._stops();
        return [...this._breakpoints, ...this._haltColumns].
            map(column => stops[this._operationColumns.filter(col => col < column).length]);
    }

    /**
     * @param {!int} target The step a run is heading for.
     * @returns {!int} Where it gets to: the first halt step on the way, or the target. The step the
     *     run starts from never holds it back.
     * @private
     */
    _runTarget(target) {
        return Math.min(target, ...this._haltSteps().filter(step => step > this._step));
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
            this._stepTo(0);
            this._restartOnPlay = true;
        }
        if (this._step === 0 && this._restartOnPlay) this.generation++;
        this._restartOnPlay = false;
        this._playing = true;
        this._timer = this._setInterval(() => {
            this._seek(this._runTarget(this._nextStep()));
            // A halt ends the run where it stands, the way the end of the circuit does.
            if (this._haltSteps().includes(this._step)) this.pause();
        }, Animation.PLAYHEAD_STEP_DURATION_MS);
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
