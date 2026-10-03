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
import {StablePrefix} from "../../engine/simulation/StablePrefix.js"
import {freshSeed} from "../../engine/simulation/random.js";


/**
 * Holds onto the last stats computed for one circuit, so redrawing an unchanging circuit doesn't
 * re-run it on the GPU. The playhead simulates a second, truncated circuit alongside the full one,
 * and two circuits alternating through a single slot would evict each other every frame, so each
 * gets its own.
 *
 * A cache may also keep what a circuit's columns before its first time-dependent gate leave on the
 * GPU (StablePrefix). That is for the circuit the cache is run for again and again as time moves, so
 * a cache for circuits that come and go - a drag's preview - has none.
 */
class StatsCache {
    /**
     * @param {undefined|!StablePrefix=} prefix
     */
    constructor(prefix = undefined) {
        /**
         * @type {undefined|!CircuitStats}
         * @private
         */
        this._cachedStats = undefined;
        /**
         * @type {undefined|!StablePrefix}
         */
        this.prefix = prefix;
    }

    /**
     * @param {!CircuitDefinition} circuit With its minimum wire count.
     * @param {!number} time
     * @param {*} seed
     * @returns {undefined|!CircuitStats} The stats kept for the circuit, as of the time, if they still
     *     hold: they do while the circuit and seed are the same, and either no gate in the circuit moves
     *     with time or the time is the same.
     */
    kept(circuit, time, seed) {
        const stats = this._cachedStats;
        return stats !== undefined && stats.circuitDefinition.isEqualTo(circuit) && stats.seed === seed &&
            (circuit.stableDuration() === Infinity || stats.time === time) ? stats.withTime(time) : undefined;
    }

    /**
     * @param {!CircuitStats} stats Kept for the next call, in place of those before.
     */
    keep(stats) {
        this._cachedStats = stats;
    }

    /**
     * @param {!CircuitDefinition} circuit With its minimum wire count.
     * @param {!number} time
     * @param {*} seed
     * @returns {!CircuitStats}
     */
    statsFor(circuit, time, seed) {
        const kept = this.kept(circuit, time, seed);
        if (kept !== undefined) {
            return kept;
        }
        this._cachedStats = undefined;
        const result = CircuitStats.fromCircuitAtTime(circuit, time, seed, this.prefix);
        this._cachedStats = result;
        return result;
    }

    /**
     * The stats of the circuit, and of the same circuit cut short, from one run.
     *
     * @param {!CircuitDefinition} circuit With its minimum wire count.
     * @param {!CircuitDefinition} playhead The circuit with only the columns the playhead has run.
     * @param {!number} time
     * @param {*} seed
     * @returns {!{fullStats: !CircuitStats, stats: !CircuitStats}} The first is kept; the cache for
     *     the cut-short circuit is for the caller to keep the second in.
     */
    statsWithPlayhead(circuit, playhead, time, seed) {
        this._cachedStats = undefined;
        const result = CircuitStats.fromCircuitAtTimeWithPlayhead(circuit, playhead, time, seed, this.prefix);
        this._cachedStats = result.fullStats;
        return result;
    }

    /**
     * @param {!CircuitDefinition} circuit With its minimum wire count.
     * @param {*} seed
     * @returns {!boolean} Whether a run of the circuit would start from what is kept, or has nothing to
     *     start from, rather than be the one that makes it.
     */
    isSettledFor(circuit, seed) {
        const length = this.prefix === undefined ? 0 : StablePrefix.keptLength(circuit);
        return length === 0 || this.prefix.heldFor(circuit, seed, length) !== undefined;
    }

    /** Lets go of what the cache holds on the GPU. */
    release() {
        this.prefix?.release();
    }
}

/**
 * Stats being worked out in the background for the circuit on screen, for a frame to pick up once
 * the GPU has done.
 *
 * @typedef {!{
 *     circuit: !CircuitDefinition,
 *     wireCount: !int,
 *     step: !int,
 *     seed: *,
 *     phase: !number,
 *     pending: !PendingCircuitStats,
 *     stillStats: (undefined|!CircuitStats)
 * }} BackgroundRun
 *     `stillStats` are the stats of the circuit up to the playhead when no gate there moves with time,
 *     which then stay as they are while the run works out the rest.
 */

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
     */
    constructor(nowMillisFunc = () => clock.now()) {
        /**
         * @type {!function(): !number}
         * @private
         */
        this._nowMillis = nowMillisFunc;
        /**
         * Where in the animation cycle the simulator is, from 0 to 1.
         * @type {!number}
         * @private
         */
        this._cycleTime = 0;
        /**
         * How many times faster than Animation.CYCLE_DURATION_MS the cycle runs.
         * @type {!number}
         * @private
         */
        this._speed = 1;
        /**
         * The holdClock() calls still in force, each by what it holds the cycle for.
         * @type {!Array.<!string>}
         * @private
         */
        this._holds = [];
        /**
         * What stands the cycle still, for the Time lane to say: 'take' while a restored take pins its
         * phase, 'recording' while a whole run records, 'paused' while the Time lane (or Reduce
         * Motion) pauses it, and undefined while it runs. The playhead never holds it: steps and
         * time are separate lanes.
         * @type {import("zustand/vanilla").StoreApi<{value: (undefined|!string)}>}
         */
        this.cycleHold = createValueStore(undefined);
        this.playing = false;
        this.seed = freshSeed();
        this.completed = createValueStore(undefined);
        /**
         * @type {undefined|!Object}
         * @private
         */
        this._restored = undefined;
        /**
         * @type {!number}
         * @private
         */
        this._prevRealTime = nowMillisFunc();
        /**
         * The whole circuit's stats, and what its columns before the first time-dependent gate leave.
         * @type {!StatsCache}
         * @private
         */
        this._wholeCircuitCache = new StatsCache(new StablePrefix());
        /**
         * @type {!StatsCache}
         * @private
         */
        this._playheadCache = new StatsCache();
        /**
         * The stats of a circuit shown in place of the committed one, as a drag previews it. It has
         * its own slot so that it cannot evict the committed circuit's, and no prefix, since each
         * move of the drag is another circuit.
         * @type {!StatsCache}
         * @private
         */
        this._previewCache = new StatsCache();
        /**
         * The last truncation built for the playhead, so redrawing an unchanged circuit at an
         * unchanged step doesn't rebuild and re-compare it every frame.
         * @type {undefined|!{source: !CircuitDefinition, step: !int, truncated: !CircuitDefinition, minimal: !CircuitDefinition}}
         * @private
         */
        this._cachedTruncation = undefined;
        /**
         * The last committed circuit with its minimum wire count, which is a new circuit to build
         * whenever the circuit has a wire to spare.
         * @type {undefined|!{source: !CircuitDefinition, minimal: !CircuitDefinition}}
         * @private
         */
        this._cachedMinimal = undefined;
        /**
         * The run for the next frame to pick up, if one is under way. There is at most one.
         * @type {undefined|!BackgroundRun}
         * @private
         */
        this._background = undefined;
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
            const elapsed = (nextRealTime - this._prevRealTime) * this._speed / Animation.CYCLE_DURATION_MS;
            this._cycleTime = (this._cycleTime + elapsed) % 1;
        }
        this._prevRealTime = nextRealTime;
        return this._cycleTime;
    }

    /**
     * Changes how fast the cycle runs from now on. The time already run counts at the speed it ran at,
     * so the phase carries on from where it is rather than jumping.
     *
     * @param {!number} speed A multiple of the pace Animation.CYCLE_DURATION_MS sets.
     */
    setSpeed(speed) {
        this.cycleTime();
        this._speed = speed;
    }

    /**
     * @returns {!boolean} Whether the animation cycle is moving: no restored take pins its phase
     *     and no hold is in force.
     */
    clockRunning() {
        return this.cycleHold.getState().value === undefined;
    }

    /**
     * @returns {undefined|!Object} The take whose phase and seed the cycle stands at, if one was
     *     restored and nothing has run since.
     */
    get restored() {
        return this._restored;
    }

    /**
     * @returns {!StablePrefix} What the committed circuit's columns before its first time-dependent
     *     one leave on the GPU. Panels that trace the circuit step by step start from it when it is
     *     held for their circuit; they only read it, and the simulator keeps it.
     */
    get wholeCircuitPrefix() {
        return this._wholeCircuitCache.prefix;
    }

    set restored(result) {
        if (result === this._restored) return;
        this._restored = result;
        this._publishHold();
    }

    /**
     * @private
     */
    _publishHold() {
        const hold = this._restored !== undefined ? 'take' :
            this._holds.includes('recording') ? 'recording' :
            this._holds.length > 0 ? this._holds[0] :
            undefined;
        if (hold !== this.cycleHold.getState().value) {
            this.cycleHold.setState({value: hold});
        }
    }

    /**
     * Puts the cycle at a phase, as scrubbing the Time lane does. A running cycle runs on from there.
     *
     * @param {!number} phase Whole turns come off, and below zero wraps round.
     */
    setPhase(phase) {
        this.cycleTime();
        this._cycleTime = ((phase % 1) + 1) % 1;
    }

    /**
     * Moves the cycle by hand, forwards or backwards, wrapping at a full cycle, as the Time lane's
     * nudges do.
     *
     * @param {!number} delta A fraction of the cycle.
     */
    advanceCycle(delta) {
        this._cycleTime = (((this.cycleTime() + delta) % 1) + 1) % 1;
    }

    /**
     * Stands the animation cycle still until the returned function is called, for work that must
     * see one phase throughout, like recording a whole run, or for the t clock's pause. The cycle
     * resumes from where it stood.
     *
     * @param {!string} reason What the cycle is held for: 'recording' or 'paused'.
     * @returns {!function(): void} Releases the hold; calling it again does nothing.
     */
    holdClock(reason) {
        this._holds.push(reason);
        this._publishHold();
        let held = true;
        return () => {
            if (held) {
                held = false;
                this._holds.splice(this._holds.indexOf(reason), 1);
                this._prevRealTime = this._nowMillis();
                this._publishHold();
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
     * Simulates a circuit shown in place of the committed one, as a drag previews it.
     *
     * @param {!CircuitDefinition} circuit
     * @returns {!CircuitStats}
     */
    simulate(circuit, phase = this._phaseFor(circuit)) {
        return this._previewCache.statsFor(circuit.withMinimumWireCount(), phase, this.seed);
    }

    /**
     * @param {!CircuitDefinition} circuit
     * @returns {!CircuitDefinition} The circuit with its minimum wire count.
     * @private
     */
    _minimalCircuit(circuit) {
        if (this._cachedMinimal?.source !== circuit) {
            this._cachedMinimal = {source: circuit, minimal: circuit.withMinimumWireCount()};
        }
        return this._cachedMinimal.minimal;
    }

    /**
     * @param {!CircuitDefinition} circuit
     * @param {!int} step Within the circuit.
     * @returns {!{truncated: !CircuitDefinition, minimal: !CircuitDefinition}} The circuit with only
     *     the first `step` columns, as it stands and with its minimum wire count.
     * @private
     */
    _truncation(circuit, step) {
        if (this._cachedTruncation === undefined ||
                this._cachedTruncation.source !== circuit ||
                this._cachedTruncation.step !== step) {
            const truncated = circuit.withColumns(circuit.columns.slice(0, step));
            this._cachedTruncation = {source: circuit, step, truncated, minimal: truncated.withMinimumWireCount()};
        }
        return this._cachedTruncation;
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
        const clamped = Math.min(circuit.columns.length, Math.max(0, step));
        return this._playheadCache.statsFor(this._truncation(circuit, clamped).minimal, time, this.seed);
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
     * Runs the circuit at the cycle's phase, and publishes the result for the panels.
     *
     * One run gives both the stats of the whole circuit and, with the playhead inside the circuit, the
     * stats up to the playhead.
     *
     * @param {!CircuitDefinition} circuit
     * @param {!int} wireCount How many wires the circuit shows.
     * @param {!int} step How many columns the playhead has run.
     * @param {!boolean=} publish Whether the result is the app's current one, for the panels and the
     *     take; a recording takes results without publishing them.
     * @param {!boolean=} mayLag Whether a frame may be shown stats a run behind, as the redraw loop's
     *     frames may. A circuit that moves with time, unchanged since the last result, is then run in
     *     the background without waiting on the GPU, and the last result stands in until the run is
     *     done. Anything else - a circuit that has just changed, a clock that stands still - is run at
     *     once, so that a frame never shows stats of the wrong circuit, nor stats of a time that is
     *     no longer the one asked for.
     * @returns {!{circuit: !CircuitDefinition, wireCount: !int, step: !int, phase: !number, seed: *,
     *     fullStats: !CircuitStats, stats: !CircuitStats}}
     */
    evaluate(circuit, wireCount, step, publish = true, mayLag = false) {
        const phase = this._phaseFor(circuit);
        step = Math.min(circuit.columns.length, Math.max(0, step));
        if (publish && this.restored?.circuit.isEqualTo(circuit) && this.restored.step === step) {
            return this.restored;
        }
        const previous = this.completed.getState().value;
        const current = publish && previous !== undefined && previous.circuit.isEqualTo(circuit) &&
            previous.step === step && previous.seed === this.seed && previous.wireCount === wireCount;
        if (current && previous.phase === phase) return previous;
        if (current && mayLag && this._mayLag(circuit)) {
            const result = this._resultInBackground(circuit, wireCount, step, phase, previous);
            if (result !== undefined) {
                return result;
            }
        }

        const {fullStats, stats} = this._statsAt(circuit, step, phase);
        const result = {circuit, wireCount, step, phase, seed: this.seed, fullStats, stats};
        if (publish) {
            // What this result is for supersedes a run still working on the one before.
            this._cancelBackground();
            this.restored = undefined;
            this.completed.setState({value: result});
        }
        return result;
    }

    /**
     * The stats of the whole circuit and of the circuit up to the playhead, at a phase, run at once.
     *
     * @param {!CircuitDefinition} circuit
     * @param {!int} step Within the circuit, or at its end.
     * @param {!number} phase
     * @returns {!{fullStats: !CircuitStats, stats: !CircuitStats}}
     * @private
     */
    _statsAt(circuit, step, phase) {
        const minimal = this._minimalCircuit(circuit);
        if (step === circuit.columns.length) {
            const fullStats = this._wholeCircuitCache.statsFor(minimal, phase, this.seed);
            return {fullStats, stats: fullStats};
        }

        const {truncated, minimal: truncatedMinimal} = this._truncation(circuit, step);
        const whole = this._wholeCircuitCache.kept(minimal, phase, this.seed);
        const cut = this._playheadCache.kept(truncatedMinimal, phase, this.seed);
        if (whole === undefined && cut === undefined) {
            // The columns up to the playhead are the first of the whole circuit's: one run does both.
            const results = this._wholeCircuitCache.statsWithPlayhead(minimal, truncated, phase, this.seed);
            this._playheadCache.keep(results.stats);
            return results;
        }
        return {
            fullStats: whole ?? this._wholeCircuitCache.statsFor(minimal, phase, this.seed),
            stats: cut ?? this._playheadCache.statsFor(truncatedMinimal, phase, this.seed),
        };
    }

    /**
     * @param {!CircuitDefinition} circuit The circuit shown, unchanged since the last result.
     * @returns {!boolean} Whether a frame may be shown the last result while a run for the circuit's
     *     next phase is in the background. That is a circuit that moves with time, while time moves,
     *     and has what its first columns leave kept, so the run is not the one that has to make it.
     * @private
     */
    _mayLag(circuit) {
        return circuit.stableDuration() < Infinity && this.clockRunning() &&
            this._wholeCircuitCache.isSettledFor(this._minimalCircuit(circuit), this.seed);
    }

    /**
     * Takes the background run's stats if it is done, and starts the next run. Short of that, the
     * last result stands.
     *
     * @param {!CircuitDefinition} circuit
     * @param {!int} wireCount
     * @param {!int} step
     * @param {!number} phase Where the cycle is now, which the next run is for.
     * @param {!Object} previous The last result, for this circuit, step and seed.
     * @returns {undefined|!Object} The result for the frame, or undefined if the frame is to run the
     *     circuit at once after all.
     * @private
     */
    _resultInBackground(circuit, wireCount, step, phase, previous) {
        let latest = previous;
        const run = this._background;
        if (run !== undefined) {
            if (run.step !== step || run.wireCount !== wireCount || run.seed !== this.seed ||
                    !run.circuit.isEqualTo(circuit)) {
                return undefined;
            }
            let done;
            try {
                done = run.pending.poll();
            } catch {
                // The context was lost meanwhile, and nothing is left to read.
                this._background = undefined;
                return undefined;
            }
            if (done === undefined) {
                return previous;
            }
            this._background = undefined;
            const stats = step === circuit.columns.length ? done.fullStats :
                done.stats ?? run.stillStats?.withTime(run.phase);
            if (stats === undefined) {
                return undefined;
            }
            latest = {circuit: run.circuit, wireCount, step, phase: run.phase, seed: run.seed,
                fullStats: done.fullStats, stats};
            this.restored = undefined;
            this.completed.setState({value: latest});
        }
        this._startBackground(circuit, wireCount, step, phase, latest);
        return latest;
    }

    /**
     * Starts running the circuit at a phase, without waiting for the GPU.
     *
     * @param {!CircuitDefinition} circuit
     * @param {!int} wireCount
     * @param {!int} step
     * @param {!number} phase
     * @param {!Object} latest The last result, whose stats up to the playhead stand while no gate there
     *     moves with time.
     * @private
     */
    _startBackground(circuit, wireCount, step, phase, latest) {
        let playhead = undefined;
        let stillStats = undefined;
        if (step < circuit.columns.length) {
            const {truncated, minimal} = this._truncation(circuit, step);
            // Short of the first gate that moves, the stats up to the playhead are the same each time.
            if (truncated.stableDuration() < Infinity) {
                playhead = minimal;
            } else {
                stillStats = latest.stats;
            }
        }
        this._background = {
            circuit, wireCount, step, phase, stillStats,
            seed: this.seed,
            pending: CircuitStats.startFromCircuitAtTime(
                this._minimalCircuit(circuit), playhead, phase, this.seed, this._wholeCircuitCache.prefix),
        };
    }

    /**
     * Drops the run in the background, if any, freeing what it holds on the GPU.
     * @private
     */
    _cancelBackground() {
        this._background?.pending.cancel();
        this._background = undefined;
    }

    /**
     * Lets go of what the simulator holds on the GPU: a run in the background and the state its
     * time-dependent circuit starts from.
     */
    dispose() {
        this._cancelBackground();
        this._wholeCircuitCache.release();
    }
}

export {Simulator}
