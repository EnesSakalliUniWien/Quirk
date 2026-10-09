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
import {createValueStore} from '../../base/valueStore.js';
/** @typedef {import("../../circuit/model/CircuitDefinition.js").CircuitDefinition} CircuitDefinition */
import {Animation} from "../../config/Animation.js"
import {CircuitStats} from "../../engine/simulation/CircuitStats.js"
import {CircuitCheckpoints} from "../../engine/simulation/CircuitCheckpoints.js"
import {freshSeed} from "../../engine/simulation/random.js";


/**
 * Holds onto the last stats computed for one circuit, so redrawing an unchanging circuit doesn't
 * re-run it on the GPU, and onto the states it passed through, so a changed circuit re-runs only
 * from the first column that differs. The playhead simulates a second, truncated circuit alongside
 * the full one, and two circuits alternating through a single slot would evict each other every
 * frame, so each gets its own.
 */
class StatsCache {
    /**
     * @param {!boolean} keepCheckpoints Whether to hold the states between runs.
     */
    constructor(keepCheckpoints) {
        /**
         * @type {undefined|!CircuitStats}
         * @private
         */
        this._cachedStats = undefined;
        /**
         * @type {undefined|!CircuitCheckpoints}
         * @private
         */
        this._checkpoints = keepCheckpoints ? new CircuitCheckpoints() : undefined;
        /**
         * A run whose statistics are still on their way back from the GPU.
         * @type {undefined|!PendingCircuitStats}
         * @private
         */
        this._pending = undefined;
    }

    /**
     * Returns the held states to the texture pool; the next run starts from the initial state.
     */
    releaseCheckpoints() {
        this._cancelPending();
        this._checkpoints?.release();
    }

    /**
     * @param {!CircuitDefinition} circuit
     * @param {!number} time
     * @returns {!CircuitStats}
     */
    statsFor(circuit, time, seed) {
        circuit = circuit.withMinimumWireCount();
        this.settle();
        if (this._matches(circuit, time, seed)) {
            return this._cachedStats.withTime(time);
        }

        this._cancelPending();
        this._cachedStats = undefined;
        const result = CircuitStats.fromCircuitAtTime(circuit, time, seed, this._checkpoints);
        this._cachedStats = result;
        return result;
    }

    /**
     * Starts running the circuit without waiting for its results, unless they are already here. A
     * run already under way for anything else is abandoned.
     *
     * @param {!CircuitDefinition} circuit
     * @param {!number} time
     * @param {*} seed
     */
    start(circuit, time, seed) {
        circuit = circuit.withMinimumWireCount();
        if (this._matches(circuit, time, seed)) {
            return;
        }
        this._cancelPending();
        this._pending = CircuitStats.startFromCircuitAtTime(circuit, time, seed, this._checkpoints);
    }

    /**
     * Takes in the run under way if its results have arrived. Never waits.
     */
    settle() {
        if (this._pending !== undefined && this._pending.isReady()) {
            this._cachedStats = this._pending.finish();
            this._pending = undefined;
        }
    }

    /**
     * @returns {!boolean} Whether a run's results are still on their way.
     */
    isBusy() {
        return this._pending !== undefined;
    }

    /**
     * @param {!CircuitDefinition} circuit Already at its minimum wire count.
     * @param {*} seed
     * @returns {undefined|!CircuitStats} The last results in, if they are for this circuit and seed, at
     *     whatever time they were computed for.
     */
    latestFor(circuit, seed) {
        const stats = this._cachedStats;
        return stats !== undefined && stats.circuitDefinition.isEqualTo(circuit) && stats.seed === seed ?
            stats : undefined;
    }

    /**
     * @param {!CircuitDefinition} circuit Already at its minimum wire count.
     * @param {!number} time
     * @param {*} seed
     * @returns {!boolean}
     * @private
     */
    _matches(circuit, time, seed) {
        return this.latestFor(circuit, seed) !== undefined &&
            (circuit.stableDuration() === Infinity || this._cachedStats.time === time);
    }

    /**
     * @private
     */
    _cancelPending() {
        this._pending?.cancel();
        this._pending = undefined;
    }
}

/**
 * Runs circuits and remembers the results, against one clock.
 *
 * The clock is accepted rather than created, so a test can drive the cycle by hand; the app
 * constructs one Simulator and shares it, because the cycle phase and the caches only make sense
 * once per app.
 */
class Simulator {
    /**
     * @param {!function(): !number} nowMillisFunc Wall-clock milliseconds; the default is the
     *     app's clock.
     * @param {!function(): !number} cycleDurationMillisFunc How long a cycle takes now; the app
     *     passes the user's setting, read afresh on every advance so a change applies at once.
     * @param {!boolean} keepCheckpoints Whether to hold on to the states each run passed through,
     *     so the next run starts where the circuit first changed. They stay in GPU memory until
     *     releaseCheckpoints, so only the app's long-lived simulator keeps them.
     */
    constructor(nowMillisFunc = () => clock.now(), cycleDurationMillisFunc = () => Animation.CYCLE_DURATION_MS,
                {keepCheckpoints = false} = {}) {
        /**
         * @type {!function(): !number}
         * @private
         */
        this._nowMillis = nowMillisFunc;
        /**
         * @type {!function(): !number}
         * @private
         */
        this._cycleDurationMillis = cycleDurationMillisFunc;
        /**
         * Where in the animation cycle the simulator is, from 0 to 1.
         * @type {!number}
         * @private
         */
        this._cycleTime = 0;
        /**
         * How many holdClock() calls are still in force.
         * @type {!int}
         * @private
         */
        this._holds = 0;
        /**
         * Whether the animation is stopped. While it is, the cycle stands still between calls to
         * advanceCycle, which is how the playhead's steps move it.
         */
        this.animationStopped = createValueStore(false);
        this.playing = false;
        this.seed = freshSeed();
        this.completed = createValueStore(undefined);
        this.restored = undefined;
        /**
         * @type {!number}
         * @private
         */
        this._prevRealTime = nowMillisFunc();
        /**
         * @type {!StatsCache}
         * @private
         */
        this._wholeCircuitCache = new StatsCache(keepCheckpoints);
        /**
         * @type {!StatsCache}
         * @private
         */
        this._playheadCache = new StatsCache(keepCheckpoints);
        /**
         * The last truncation built for the playhead, so redrawing an unchanged circuit at an
         * unchanged step doesn't rebuild and re-compare it every frame.
         * @type {undefined|!{source: !CircuitDefinition, step: !int, truncated: !CircuitDefinition}}
         * @private
         */
        this._cachedTruncation = undefined;
    }

    /**
     * Advances the animation cycle to now and returns where it is, from 0 to 1. Time-dependent
     * gates like X^t take their parameter from this. The cycle runs whether or not the transport
     * is playing, and stands still while a restored take pins its phase or a hold is in force.
     *
     * @returns {!number}
     */
    cycleTime() {
        const nextRealTime = this._nowMillis();
        if (this.clockRunning()) {
            const elapsed = (nextRealTime - this._prevRealTime) / this._cycleDurationMillis();
            this._cycleTime = (this._cycleTime + elapsed) % 1;
        }
        this._prevRealTime = nextRealTime;
        return this._cycleTime;
    }

    /**
     * @returns {!boolean} Whether the animation cycle is moving: the animation is not stopped, no
     *     restored take pins its phase and no hold is in force.
     */
    clockRunning() {
        return !this.animationStopped.getState().value && this.restored === undefined && this._holds === 0;
    }

    /**
     * Stops or resumes the animation. Stopped, the cycle keeps its phase; resumed, it moves on from
     * there, without jumping over the time it stood still.
     *
     * @param {!boolean} stopped
     */
    setAnimationStopped(stopped) {
        if (stopped === this.animationStopped.getState().value) return;
        this.cycleTime();
        this.animationStopped.setState({value: stopped});
        this._prevRealTime = this._nowMillis();
    }

    /**
     * Moves the cycle by hand, forwards or backwards, wrapping at a full cycle. The playhead's steps
     * move a stopped animation this way, an increment a step.
     *
     * @param {!number} delta A fraction of the cycle.
     */
    advanceCycle(delta) {
        this._cycleTime = (((this.cycleTime() + delta) % 1) + 1) % 1;
    }

    /**
     * Stands the animation cycle still until the returned function is called, for work that must
     * see one phase throughout, like recording a whole run. The cycle resumes from where it stood.
     *
     * @returns {!function(): void} Releases the hold; calling it again does nothing.
     */
    holdClock() {
        this._holds++;
        let held = true;
        return () => {
            if (held) {
                held = false;
                this._holds--;
                this._prevRealTime = this._nowMillis();
            }
        };
    }

    /**
     * The phase to run a circuit at. A circuit with time-dependent gates runs at the moving cycle.
     * Any other circuit runs where the cycle stands, without moving it, so its results stay equal
     * from frame to frame and nothing republishes them for a phase they ignore.
     *
     * @param {!CircuitDefinition} circuit
     * @returns {!number}
     * @private
     */
    _phaseFor(circuit) {
        if (circuit.stableDuration() < Infinity) {
            return this.cycleTime();
        }
        // Resume from here when the circuit next animates, rather than jumping over the still time.
        this._prevRealTime = this._nowMillis();
        return this._cycleTime;
    }

    /**
     * @param {!CircuitDefinition} circuit
     * @returns {!CircuitStats}
     */
    simulate(circuit, phase = this._phaseFor(circuit)) {
        return this._wholeCircuitCache.statsFor(circuit, phase, this.seed);
    }

    /**
     * Simulates the circuit as far as the playhead has run it, i.e. with only the first `step`
     * columns.
     *
     * @param {!CircuitDefinition} circuit
     * @param {!int} step The number of columns that have executed.
     * @param {!number} time
     * @returns {!CircuitStats}
     */
    simulateAtStep(circuit, step, time) {
        return this._playheadCache.statsFor(this._truncated(circuit, step), time, this.seed);
    }

    /**
     * @param {!CircuitDefinition} circuit
     * @param {!int} step
     * @returns {!CircuitDefinition} The circuit's first `step` columns.
     * @private
     */
    _truncated(circuit, step) {
        const clamped = Math.min(circuit.columns.length, Math.max(0, step));
        if (this._cachedTruncation === undefined ||
                this._cachedTruncation.source !== circuit ||
                this._cachedTruncation.step !== clamped) {
            this._cachedTruncation = {
                source: circuit,
                step: clamped,
                truncated: circuit.withColumns(circuit.columns.slice(0, clamped))
            };
        }
        return this._cachedTruncation.truncated;
    }

    /**
     * @returns {!boolean} Whether results started by a lagging evaluate are still on their way, so the
     *     caller should come back for them.
     */
    hasPendingRuns() {
        return this._wholeCircuitCache.isBusy() || this._playheadCache.isBusy();
    }
    /**
     * Returns the states the simulator holds to the texture pool.
     */
    releaseCheckpoints() {
        this._wholeCircuitCache.releaseCheckpoints();
        this._playheadCache.releaseCheckpoints();
    }

    /**
     * Follows the transport. Playing no longer moves the animation cycle, which runs on its own, but
     * a whole-run recording cancels if playback starts.
     *
     * @param {!boolean} playing
     * @param {!boolean=} restart Whether playback starts a new run, with a fresh seed.
     */
    setPlaying(playing, restart = false) {
        this.playing = playing;
        if (restart) this.newRun();
        if (playing) this.restored = undefined;
    }

    newRun() {
        this.seed = freshSeed();
        this.restored = undefined;
    }

    restore(result) {
        this.playing = false;
        this._cycleTime = result.phase;
        this._prevRealTime = this._nowMillis();
        this.seed = result.seed;
        this.restored = result;
        this.completed.setState({value: result});
    }

    /**
     * Runs the circuit, whole and as far as the playhead has run it, and publishes the result.
     *
     * @param {!CircuitDefinition} circuit
     * @param {!int} wireCount
     * @param {!int} step
     * @param {!boolean} publish
     * @param {!{mayLag: undefined|!boolean}=} options With mayLag, an animating circuit doesn't wait
     *     on the GPU: the last result stands until the results for a newer phase are back, which is
     *     at the earliest on a later frame (hasPendingRuns says when to come back). The whole-circuit
     *     and playhead results always share a phase. Anything but an animation step waits as usual.
     * @returns {!Object}
     */
    evaluate(circuit, wireCount, step, publish = true, {mayLag = false} = {}) {
        const phase = this._phaseFor(circuit);
        step = Math.min(circuit.columns.length, Math.max(0, step));
        if (publish && this.restored?.circuit.isEqualTo(circuit) && this.restored.step === step) {
            return this.restored;
        }
        const previous = this.completed.getState().value;
        const sameRun = previous?.circuit.isEqualTo(circuit) && previous.step === step &&
            previous.seed === this.seed && previous.wireCount === wireCount;
        if (publish && sameRun && previous.phase === phase) return previous;
        if (publish && sameRun && mayLag && circuit.stableDuration() < Infinity) {
            const arrived = this._evaluateWithoutWaiting(circuit, wireCount, step, phase);
            if (arrived === undefined || arrived.phase === previous.phase) return previous;
            this.completed.setState({value: arrived});
            return arrived;
        }
        const fullStats = this._wholeCircuitCache.statsFor(circuit, phase, this.seed);
        const stats = step === circuit.columns.length ? fullStats : this.simulateAtStep(circuit, step, phase);
        const result = {circuit, wireCount, step, phase, seed: this.seed, fullStats, stats};
        if (publish) {
            this.restored = undefined;
            this.completed.setState({value: result});
        }
        return result;
    }

    /**
     * Takes in whatever results have arrived and, once both caches are idle, starts on the phase
     * asked for. Starting both together keeps their results at one phase.
     *
     * @param {!CircuitDefinition} circuit
     * @param {!int} wireCount
     * @param {!int} step
     * @param {!number} phase
     * @returns {undefined|!Object} The newest result whose whole and playhead parts share a phase.
     * @private
     */
    _evaluateWithoutWaiting(circuit, wireCount, step, phase) {
        const atEnd = step === circuit.columns.length;
        const truncated = atEnd ? undefined : this._truncated(circuit, step);
        this._wholeCircuitCache.settle();
        this._playheadCache.settle();
        if (this.hasPendingRuns()) {
            return undefined;
        }

        const fullStats = this._wholeCircuitCache.latestFor(circuit.withMinimumWireCount(), this.seed);
        let stats = atEnd ? fullStats : this._playheadCache.latestFor(truncated.withMinimumWireCount(), this.seed);
        // Columns before the playhead that don't change with time are right at any phase.
        if (!atEnd && stats !== undefined && fullStats !== undefined && truncated.stableDuration() === Infinity) {
            stats = stats.withTime(fullStats.time);
        }
        const result = fullStats !== undefined && stats !== undefined && stats.time === fullStats.time ?
            {circuit, wireCount, step, phase: fullStats.time, seed: this.seed, fullStats, stats} :
            undefined;
        if (result?.phase !== phase) {
            this._wholeCircuitCache.start(circuit, phase, this.seed);
            if (!atEnd) {
                this._playheadCache.start(truncated, phase, this.seed);
            }
        }
        return result;
    }
}

export {Simulator}
