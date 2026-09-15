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

import {CircuitDefinition} from "../../circuit/model/CircuitDefinition.js"
import {CircuitEvalContext} from "./CircuitEvalContext.js"
import {CircuitShaders} from "./gpu/CircuitShaders.js"
import {KetTextureUtil} from "./gpu/KetTextureUtil.js"
import {Controls} from "../../circuit/model/Controls.js"
import {DetailedError} from "../../base/DetailedError.js"
import {Matrix} from "../math/matrix/Matrix.js"
import {Shaders} from "../webgl/operations/Shaders.js"
import {Serializer} from "../../serialization/Serializer.js"
import {reportRecoveredError} from "../../diagnostics/errorReporter.js"
import {advanceStateWithCircuit} from "./CircuitComputeUtil.js"
import {currentShaderCoder} from "../webgl/coder/ShaderCoders.js"
import {WglTextureTrader} from "../webgl/texture/WglTextureTrader.js"
import {ReadableJson} from "../math/matrix/ReadableJson.js"
import {QubitMatrix} from "../math/matrix/QubitMatrix.js"

import {randomFor} from "./random.js";

class CircuitStats {
    /**
     * @param {!CircuitDefinition} circuitDefinition
     * @param {!number} time
     * @param {!Array.<!number>} survivalRates
     * @param {!Array.<!Array.<!Matrix>>} singleQubitDensities
     * @param {!Matrix} finalState
     * @param {!Map<!string, *>} customStatsProcessed
     */
    constructor(circuitDefinition,
                time,
                survivalRates,
                singleQubitDensities,
                finalState,
                customStatsProcessed, seed = undefined, sampleOutcomes = {}) {
        /**
         * The circuit that these stats apply to.
         * @type {!CircuitDefinition}
         */
        this.circuitDefinition = circuitDefinition;
        /**
         * The time these stats apply to.
         * @type {!number}
         */
        this.time = time;
        this.seed = seed;
        this.sampleOutcomes = sampleOutcomes;
        /**
         * @type {!Array.<!number>}
         * @private
         */
        this._survivalRates = survivalRates;
        /**
         * The density matrix of individual qubits.
         * (This case is special-cased, instead of using customStats like the other density displays, because
         *  single-qubit displays are so much more common. Also they appear in bulk at the end of the circuit.)
         * @type {!Array.<!Array.<!Matrix>>}
         * @private
         */
        this._qubitDensities = singleQubitDensities;
        /**
         * The output quantum superposition, as a column vector.
         * @type {!Matrix}
         */
        this.finalState = finalState;
        /**
         * @type {!Map.<!string, *>}
         * @private
         */
        this._customStatsProcessed = customStatsProcessed;
    }

    /**
     * Returns the density matrix of a qubit at a particular point in the circuit.
     *
     * Note: only available if there was a corresponding display gate at that position. Otherwise result is NaN.
     *
     * @param {!int} colIndex
     * @param {!int} wireIndex
     * @returns {!Matrix}
     */
    qubitDensityMatrix(colIndex, wireIndex) {
        if (wireIndex < 0) {
            throw new DetailedError("Bad wireIndex", {wireIndex, colIndex});
        }

        // The initial state is all-qubits-off.
        if (colIndex < 0 || wireIndex >= this.circuitDefinition.numWires) {
            if (wireIndex >= this.circuitDefinition.numWires && this.qubitDensityMatrix(colIndex, 0).hasNaN()) {
                return Matrix.zero(2, 2).times(NaN);
            }
            const buf = new Float32Array(8);
            buf[0] = 1;
            return new Matrix(2, 2, buf);
        }

        const col = Math.min(colIndex, this._qubitDensities.length - 1);
        if (col < 0 || wireIndex >= this._qubitDensities[col].length) {
            return Matrix.zero(2, 2).times(NaN);
        }
        return this._qubitDensities[col][wireIndex];
    }

    /**
     * Converts the circuit stats into an exportable JSON object.
     * @param {!boolean} includeOutputAmplitudes
     * @returns {!object}
     */
    toReadableJson(includeOutputAmplitudes=true) {
        const result = {
            time_parameter: this.time,
            circuit: Serializer.toJson(this.circuitDefinition),
            chance_of_surviving_to_each_column: this._survivalRates,
            computed_bloch_vectors_by_column_then_wire: this._qubitDensities.map(
                col => col.map(singleQubitDensityMatrixToReadableJson)
            ),
            displays: this._customStatsToReadableJson()
        };
        if (Object.keys(this.sampleOutcomes).length) result.sample_outcomes = this.sampleOutcomes;
        if (includeOutputAmplitudes) {
            result['output_amplitudes'] = ReadableJson.complexVector(this.finalState.getColumn(0));
        }
        return result;
    }

    /**
     * Copies the collected histories for recording without exposing their mutable containers.
     * Density matrices become interleaved numeric arrays; custom display payloads retain their
     * gate-specific types and are read-only, just like customStatsForSlot's return value.
     * File versions, number encoding and displayed-wire padding belong to the caller.
     */
    snapshotData() {
        return {
            survival: [...this._survivalRates],
            densities: this._qubitDensities.map(col => col.map(m => [...m.rawBuffer()])),
            custom: [...this.customStatsEntries()],
        };
    }

    /** Read-only display payloads in evaluation order, keyed by "column:row". */
    customStatsEntries() {
        return this._customStatsProcessed.entries();
    }

    _customStatsToReadableJson() {
        const result = [];
        for (let [key, data] of this._customStatsProcessed.entries()) {
            let [col, row] = key.split(':');
            row = parseInt(row);
            col = parseInt(col);
            const gate = this.circuitDefinition.columns[col].gates[row];
            if (gate.processedStatsToJsonFunc !== undefined) {
                data = gate.processedStatsToJsonFunc(data);
            }
            result.push({
                location: {
                    wire: row,
                    column: col,
                },
                type: {
                    serialized_id: gate.serializedId,
                    name: gate.name,
                },
                data
            });
        }
        return result;
    }

    /**
     * Determines how often the circuit evaluation survives to the given column, without being post-selected out.
     *
     * Note that over-unitary gates will increase this number, so perhaps 'survival rate' isn't quite the best name.
     *
     * @param {!int} colIndex
     * @returns {!number}
     */
    survivalRate(colIndex) {
        colIndex = Math.min(colIndex, this._survivalRates.length - 1);
        return colIndex < 0 ? 1 : this._survivalRates[colIndex];
    }

    /**
     * @param {!int} col
     * @param {!int} row
     * @returns {undefined|*}
     */
    customStatsForSlot(col, row) {
        const key = col+":"+row;
        return this._customStatsProcessed.has(key) ? this._customStatsProcessed.get(key) : undefined;
    }

    /**
     * Returns the probability that a wire would be on if it was measured just before a given column, but conditioned on
     * wires with controls in that column matching their controls.
     * A wire is never conditioned on itself; self-conditions are ignored when computing the probability.
     *
     * @param {int} wireIndex
     * @param {int|Infinity} colIndex
     * @returns {!number}
     */
    controlledWireProbabilityJustAfter(wireIndex, colIndex) {
        return this.qubitDensityMatrix(colIndex, wireIndex).rawBuffer()[6];
    }

    /**
     * @param {!number} time
     * @returns {!CircuitStats}
     */
    withTime(time) {
        return new CircuitStats(
            this.circuitDefinition,
            time,
            this._survivalRates,
            this._qubitDensities,
            this.finalState,
            this._customStatsProcessed, this.seed, this.sampleOutcomes);
    }

    /**
     * @param {!CircuitDefinition} circuitDefinition
     * @param {!number} time
     * @returns {!CircuitStats}
     */
    static withNanDataFromCircuitAtTime(circuitDefinition, time) {
        return new CircuitStats(
            circuitDefinition,
            time,
            [1],
            [],
            Matrix.zero(1, 1 << circuitDefinition.numWires).times(NaN),
            new Map());
    }

    /**
     * @param {!CircuitDefinition} circuitDefinition
     * @param {!number} time
     * @returns {!CircuitStats}
     */
    static fromCircuitAtTime(circuitDefinition, time, seed = undefined) {
        try {
            return CircuitStats._fromCircuitAtTime_noFallback(circuitDefinition, time, seed);
        } catch (ex) {
            reportRecoveredError(
                `Defaulted to NaN results. Computing circuit values failed.`,
                {circuitDefinition: Serializer.toJson(circuitDefinition)},
                ex);
            return CircuitStats.withNanDataFromCircuitAtTime(circuitDefinition, time);
        }
    }

    /**
     * Returns the same density matrix, but without off-diagonal terms connecting different measured-bit values.
     * @param {!Matrix} densityMatrix
     * @param {!int} isMeasuredMask A bitmask where each 1 corresponds to a measured qubit position.
     * @returns {!Matrix}
     */
    static decohereMeasuredBitsInDensityMatrix(densityMatrix, isMeasuredMask) {
        if (isMeasuredMask === 0) {
            return densityMatrix;
        }

        const buf = new Float32Array(densityMatrix.rawBuffer());
        const n = densityMatrix.width();
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                if (((row ^ col) & isMeasuredMask) !== 0) {
                    const k = (row*n + col)*2;
                    buf[k] = 0;
                    buf[k+1] = 0;
                }
            }
        }
        return new Matrix(n, n, buf);
    }

    /**
     * @param {!Array.<!Matrix>} rawMatrices
     * @param {!int} numWires
     * @param {!int} qubitSpan
     * @param {!int} isMeasuredMask
     * @param {!int} hasDisplayMask
     * @returns {!Array.<!Matrix>}
     */
    static scatterAndDecohereDensities(rawMatrices, numWires, qubitSpan, isMeasuredMask, hasDisplayMask) {
        const nanMatrix = Matrix.zero(1 << qubitSpan, 1 << qubitSpan).times(NaN);
        let used = 0;
        const result = [];
        for (let row = 0; row < numWires - qubitSpan + 1; row++) {
            if ((hasDisplayMask & (1 << row)) === 0) {
                result.push(nanMatrix);
            } else {
                result.push(CircuitStats.decohereMeasuredBitsInDensityMatrix(
                    rawMatrices[used++],
                    (isMeasuredMask >> row) & ((1 << qubitSpan) - 1)));
            }
        }
        return result;
    }

    /**
     * @param {!CircuitDefinition} circuitDefinition
     * @param {!Array.<!Float32Array>} colQubitDensitiesPixelData
     * @returns {!Array.<!Array<!Matrix>>}
     * @private
     */
    static _extractColumnQubitStatsFromPixelDatas(circuitDefinition, colQubitDensitiesPixelData) {
        const qubitDensityGrid = [];
        for (let col = 0; col < colQubitDensitiesPixelData.length; col++) {
            const dataHasStatsMask = col === circuitDefinition.columns.length ?
                -1 : // All wires have an output display in the after-last column.
                circuitDefinition.colDesiredSingleQubitStatsMask(col);
            qubitDensityGrid.push(CircuitStats.scatterAndDecohereDensities(
                KetTextureUtil.pixelsToQubitDensityMatrices(colQubitDensitiesPixelData[col]),
                circuitDefinition.numWires,
                1,
                circuitDefinition.colIsMeasuredMask(col),
                dataHasStatsMask));
        }

        return qubitDensityGrid;
    }

    /**
     * @param {!Array.<!Float32Array>} normsPixelData
     * @returns {!Array.<!number>}
     * @private
     */
    static _extractColumnSurvivalRateStatsFromPixelDatas(normsPixelData) {
        let curSurvivalRate = 1;
        const survivalRates = [];
        for (let col = 0; col < normsPixelData.length; col++) {
            if (normsPixelData[col].length > 0) {
                curSurvivalRate = normsPixelData[col][0];
            }
            survivalRates.push(curSurvivalRate);
        }
        return survivalRates;
    }

    /**
     * @param {!CircuitDefinition} circuitDefinition
     * @param {!number} time
     * @returns {!CircuitStats}
     */
    static _fromCircuitAtTime_noFallback(circuitDefinition, time, seed = undefined) {
        circuitDefinition = circuitDefinition.withMinimumWireCount();
        const textures = collectCircuitStatsTextures(circuitDefinition, time, seed);
        const pixelData = readCircuitStatsPixels(textures);

        const qubitDensities =
            CircuitStats._extractColumnQubitStatsFromPixelDatas(circuitDefinition, pixelData.colQubitDensities);
        const survivalRates =
            CircuitStats._extractColumnSurvivalRateStatsFromPixelDatas(pixelData.colNorms);
        const outputSuperposition = KetTextureUtil.pixelsToAmplitudes(
            pixelData.output,
            survivalRates.length === 0 ? 1 : survivalRates.at(-1));

        const customStatsProcessed = processCustomStats(
            circuitDefinition, textures.customStatsMap, pixelData.customStats);
        const sampleOutcomes = collectSampleOutcomes(circuitDefinition, customStatsProcessed, time, seed);
        return new CircuitStats(
            circuitDefinition,
            time,
            survivalRates,
            qubitDensities,
            outputSuperposition,
            customStatsProcessed, seed, sampleOutcomes);
    }
}

/** Runs the circuit and packs the final state for a single combined texture readback. */
function collectCircuitStatsTextures(circuitDefinition, time, seed) {
    const numWires = circuitDefinition.numWires;

    // Advance state while collecting stats into textures.
    const stateTrader = new WglTextureTrader(CircuitShaders.classicalState(0).toVec2Texture(numWires));
    const controlTex = CircuitShaders.controlMask(Controls.NONE).toBoolTexture(numWires);
    const {colQubitDensities, colNorms, customStats, customStatsMap} = advanceStateWithCircuit(
        new CircuitEvalContext(
            time,
            0,
            numWires,
            Controls.NONE,
            controlTex,
            Controls.NONE,
            stateTrader,
            new Map(), seed === undefined ? Math.random : randomFor(seed)),
        circuitDefinition,
        true);
    controlTex.deallocByDepositingInPool("controlTex in _fromCircuitAtTime_noFallback");
    if (currentShaderCoder().vec2.needRearrangingToBeInVec4Format) {
        stateTrader.shadeHalveAndTrade(Shaders.packVec2IntoVec4);
    }
    return {output: stateTrader.currentTexture, colQubitDensities, colNorms, customStats, customStatsMap};
}

/** Reads and releases the collected textures; the location map stays on the CPU. */
function readCircuitStatsPixels({output, colQubitDensities, colNorms, customStats}) {
    // Preserve the original readback order, including each display's texture order.
    const pixels = KetTextureUtil.mergedReadFloats([
        ...colNorms, ...colQubitDensities, ...customStats.flat(), output
    ])[Symbol.iterator]();
    return {
        colNorms: colNorms.map(() => pixels.next().value),
        colQubitDensities: colQubitDensities.map(() => pixels.next().value),
        customStats: customStats.map(stat => Array.isArray(stat)
            ? stat.map(() => pixels.next().value)
            : pixels.next().value),
        output: pixels.next().value
    };
}

/** Converts each custom display texture using its gate's postprocessor, in evaluation order. */
function processCustomStats(circuitDefinition, customStatsMap, customStatsPixelData) {
    const customStatsProcessed = new Map();
    for (const {col, row, out} of customStatsMap) {
        const func = circuitDefinition.gateInSlot(col, row).customStatPostProcesser || (e => e);
        customStatsProcessed.set(col+":"+row, func(customStatsPixelData[out], circuitDefinition, col, row));
    }
    return customStatsProcessed;
}

/** Records Sample outcomes using a separate random stream for each display location. */
function collectSampleOutcomes(circuitDefinition, customStatsProcessed, time, seed) {
    const sampleOutcomes = {};
    for (const [location, data] of customStatsProcessed) {
        const [col, row] = location.split(":").map(Number);
        if (!/^Sample\d+$/.test(circuitDefinition.gateInSlot(col, row).serializedId)) {
            continue;
        }
        const rng = randomFor(`${seed ?? time}:sample:${location}`);
        const outcome = sampleOutcome(data, rng);
        if (outcome !== undefined) {
            sampleOutcomes[location] = outcome;
        }
    }
    return sampleOutcomes;
}

/** Selects one outcome from a probability column, or none when its data is unavailable. */
function sampleOutcome(data, rng) {
    let remaining = rng();
    const buf = data.rawBuffer();
    if (data.hasNaN()) {
        return undefined;
    }
    for (let i = 0; i < data.height(); i++) {
        remaining -= buf[i * 2];
        if (remaining < 0 || i === data.height() - 1) {
            return {i, p: buf[i * 2]};
        }
    }
    return undefined;
}

/**
 * @param {!Matrix} matrix
 */
function singleQubitDensityMatrixToReadableJson(matrix) {
    if (matrix.hasNaN()) {
        return null;
    }
    let [x, y, z] = QubitMatrix.densityMatrixToBlochVector(matrix);
    x *= -1;
    z *= -1;
    return {x, y, z};
}

CircuitStats.EMPTY = CircuitStats.withNanDataFromCircuitAtTime(CircuitDefinition.EMPTY, 0);

export {CircuitStats}
