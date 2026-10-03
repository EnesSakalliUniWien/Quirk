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

import {equate_Maps} from "../../base/Equate.js"
import {initializedWglContext} from "../webgl/context/WglContext.js"

/**
 * What a circuit leaves behind in its first columns, for as long as they stay as they are.
 *
 * A circuit with a gate that moves with time is run again every frame, but the columns before that
 * gate give the same answer every time: the state after them, and the stats read from them. This
 * keeps that state on the GPU, with the stats already read, so a run can start where they end and
 * apply only the columns that move.
 *
 * It holds one prefix, for the circuit it was last given. What the prefix depends on is every
 * column in it, the wire count, the initial values, the registers and the seed. A prefix whose
 * evaluation drew random numbers is not kept - a later run would start its random stream from the
 * wrong place - and is remembered as not kept, so that it is not tried again.
 *
 * The state is a texture taken out of the texture pool, so whoever holds a prefix must `release` it
 * when done, or the pool counts it as leaked.
 */
class StablePrefix {
    constructor() {
        /**
         * @type {undefined|!KeptPrefix}
         * @private
         */
        this._held = undefined;
    }

    /**
     * How many of the circuit's leading columns would be kept: those before the first that moves with
     * time.
     *
     * @param {!CircuitDefinition} circuit
     * @returns {!int} 0 when there is nothing to keep - the first column moves, or none does, and a
     *     circuit that never moves is run once and its stats kept whole.
     */
    static keptLength(circuit) {
        const moving = circuit.columns.findIndex(column => column.stableDuration() !== Infinity);
        return moving === -1 ? 0 : moving;
    }

    /**
     * What is kept for the circuit, if its first columns are the ones kept and the seed is the same.
     * A prefix from before the context was lost is gone, since the texture died with the context.
     *
     * @param {!CircuitDefinition} circuit
     * @param {*} seed
     * @param {!int=} length The circuit's keptLength, when the caller has it.
     * @returns {undefined|!KeptPrefix} Its `state` is undefined when the prefix is known to draw random
     *     numbers, and so is not kept.
     */
    heldFor(circuit, seed, length = StablePrefix.keptLength(circuit)) {
        const held = this._held;
        if (held === undefined) {
            return undefined;
        }
        if (held.state !== undefined && held.lifetime !== initializedWglContext().lifetimeCounter) {
            this.release();
            return undefined;
        }
        const sameWires = held.numWires === circuit.numWires &&
            held.outerRowOffset === circuit.outerRowOffset &&
            equate_Maps(held.outerContext, circuit.outerContext) &&
            equate_Maps(held.customInitialValues, circuit.customInitialValues) &&
            held.registers.isEqualTo(circuit.registers);
        return sameWires && held.seed === seed && held.length === length &&
            held.columns.every((column, k) => column.isEqualTo(circuit.columns[k])) ?
            held : undefined;
    }

    /**
     * Keeps the state a circuit has after its first columns, in place of whatever was kept. Takes over
     * the state texture.
     *
     * @param {!CircuitDefinition} circuit
     * @param {*} seed
     * @param {!{state: !WglTexture, colNorms: !Array.<!Float32Array>,
     *     colQubitDensities: !Array.<!Float32Array>, customStats: !Array.<!Float32Array|!Array.<!Float32Array>>,
     *     customStatsMap: !Array.<!{col: !int, row: !int, out: !int}>}} kept The state, and the pixels
     *     already read for the first columns' stats, in the order a run reads them.
     */
    keep(circuit, seed, kept) {
        this.release();
        this._held = this._describe(circuit, seed, kept);
    }

    /**
     * Remembers that the circuit's first columns draw random numbers, so there is nothing to keep.
     *
     * @param {!CircuitDefinition} circuit
     * @param {*} seed
     */
    keepNothing(circuit, seed) {
        this.release();
        this._held = this._describe(circuit, seed, undefined);
    }

    /** Lets go of what is kept, giving its texture back to the pool. */
    release() {
        const state = this._held?.state;
        this._held = undefined;
        // A texture that outlived its context goes back too: the pool starts it afresh when it is
        // next drawn into.
        state?.deallocByDepositingInPool("StablePrefix released");
    }

    /**
     * @param {!CircuitDefinition} circuit
     * @param {*} seed
     * @param {undefined|!Object} kept
     * @returns {!KeptPrefix}
     * @private
     */
    _describe(circuit, seed, kept) {
        const length = StablePrefix.keptLength(circuit);
        return {
            length,
            columns: circuit.columns.slice(0, length),
            numWires: circuit.numWires,
            outerRowOffset: circuit.outerRowOffset,
            outerContext: circuit.outerContext,
            customInitialValues: circuit.customInitialValues,
            registers: circuit.registers,
            seed,
            lifetime: initializedWglContext().lifetimeCounter,
            state: kept?.state,
            colNorms: kept?.colNorms ?? [],
            colQubitDensities: kept?.colQubitDensities ?? [],
            customStats: kept?.customStats ?? [],
            customStatsMap: kept?.customStatsMap ?? [],
        };
    }
}

/**
 * @typedef {!{
 *     length: !int,
 *     columns: !Array.<!GateColumn>,
 *     numWires: !int,
 *     outerRowOffset: !int,
 *     outerContext: !Map,
 *     customInitialValues: !Map,
 *     registers: !Registers,
 *     seed: *,
 *     lifetime: !int,
 *     state: (undefined|!WglTexture),
 *     colNorms: !Array.<!Float32Array>,
 *     colQubitDensities: !Array.<!Float32Array>,
 *     customStats: !Array.<!Float32Array|!Array.<!Float32Array>>,
 *     customStatsMap: !Array.<!{col: !int, row: !int, out: !int}>
 * }} KeptPrefix
 *     What a kept prefix is: how many columns, which they are and what else they depend on, and what
 *     they left - the state after them in a texture of its own, and the pixels read for their stats.
 */

export {StablePrefix}
