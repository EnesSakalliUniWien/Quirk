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

/** @typedef {import("../../circuit/model/CircuitDefinition.js").CircuitDefinition} CircuitDefinition */
import {Simulation} from "../../config/Simulation.js"
import {CircuitStats} from "../../engine/simulation/CircuitStats.js"
import {freshSeed} from "../../engine/simulation/random.js";
import {ObservableValue} from "../../base/Obs.js";

/**
 * Holds onto the last stats computed for one circuit, so redrawing an unchanging circuit doesn't
 * re-run it on the GPU. The playhead simulates a second, truncated circuit alongside the full one,
 * and two circuits alternating through a single slot would evict each other every frame, so each
 * gets its own.
 */
class StatsCache {
    constructor() {
        /**
         * @type {undefined|!CircuitStats}
         * @private
         */
        this._cachedStats = undefined;
    }

    /**
     * @param {!CircuitDefinition} circuit
     * @param {!number} time
     * @returns {!CircuitStats}
     */
    statsFor(circuit, time, seed) {
        circuit = circuit.withMinimumWireCount();
        if (this._cachedStats !== undefined && this._cachedStats.circuitDefinition.isEqualTo(circuit) &&
                this._cachedStats.seed === seed &&
                (circuit.stableDuration() === Infinity || this._cachedStats.time === time)) {
            return this._cachedStats.withTime(time);
        }

        this._cachedStats = undefined;
        const result = CircuitStats.fromCircuitAtTime(circuit, time, seed);
        this._cachedStats = result;
        return result;
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
     *     real clock.
     */
    constructor(nowMillisFunc = () => performance.now()) {
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
        this.playing = false;
        this.seed = freshSeed();
        this.completed = new ObservableValue(undefined);
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
        this._wholeCircuitCache = new StatsCache();
        /**
         * @type {!StatsCache}
         * @private
         */
        this._playheadCache = new StatsCache();
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
     * gates like X^t take their parameter from this.
     *
     * @returns {!number}
     */
    cycleTime() {
        const nextRealTime = this._nowMillis();
        const elapsed = (nextRealTime - this._prevRealTime) / Simulation.CYCLE_DURATION_MS;
        if (this.playing) this._cycleTime += elapsed;
        this._cycleTime %= 1;
        this._prevRealTime = nextRealTime;
        return this._cycleTime;
    }

    /**
     * @param {!CircuitDefinition} circuit
     * @returns {!CircuitStats}
     */
    simulate(circuit, phase = this.cycleTime()) {
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
        return this._playheadCache.statsFor(this._cachedTruncation.truncated, time, this.seed);
    }
    setPlaying(playing, restart = false) {
        this.cycleTime();
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
        this.completed.set(result);
    }

    evaluate(circuit, wireCount, step, publish = true) {
        const phase = this.cycleTime();
        step = Math.min(circuit.columns.length, Math.max(0, step));
        if (publish && this.restored?.circuit.isEqualTo(circuit) && this.restored.step === step) {
            return this.restored;
        }
        const previous = this.completed.get();
        if (publish && previous?.circuit.isEqualTo(circuit) && previous.step === step &&
                previous.phase === phase && previous.seed === this.seed && previous.wireCount === wireCount) return previous;
        const fullStats = this._wholeCircuitCache.statsFor(circuit, phase, this.seed);
        const stats = step === circuit.columns.length ? fullStats : this.simulateAtStep(circuit, step, phase);
        const result = {circuit, wireCount, step, phase, seed: this.seed, fullStats, stats};
        if (publish) {
            this.restored = undefined;
            this.completed.set(result);
        }
        return result;
    }
}

export {Simulator}
