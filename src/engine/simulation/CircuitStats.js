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

import { CircuitDefinition } from "../../circuit/model/CircuitDefinition.js";
import { KetTextureUtil } from "./gpu/KetTextureUtil.js";
import { DetailedError } from "../../base/DetailedError.js";
import { Matrix } from "../math/matrix/Matrix.js";
import { Serializer } from "../../serialization/Serializer.js";
import { reportRecoveredError } from "../../diagnostics/errorReporter.js";
import {
  readRun,
  readStatesAfterSteps,
  runCircuit,
  startReadingRun,
} from "./CircuitRun.js";
import { ReadableJson } from "../math/matrix/ReadableJson.js";
import { QubitMatrix } from "../math/matrix/QubitMatrix.js";
import { decohereMeasuredBitsInDensityMatrix } from "../math/matrix/densityMatrix.js";

import { randomFor } from "./random.js";

class CircuitStats {
  /**
   * @param {!CircuitDefinition} circuitDefinition
   * @param {!number} time
   * @param {!Array.<!number>} survivalRates
   * @param {!Array.<!Array.<!Matrix>>} singleQubitDensities
   * @param {!Matrix} finalState
   * @param {!Map<!string, *>} customStatsProcessed
   */
  constructor(
    circuitDefinition,
    time,
    survivalRates,
    singleQubitDensities,
    finalState,
    customStatsProcessed,
    seed = undefined,
    sampleOutcomes = {},
  ) {
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
      throw new DetailedError("Bad wireIndex", { wireIndex, colIndex });
    }

    // The initial state is all-qubits-off.
    if (colIndex < 0 || wireIndex >= this.circuitDefinition.numWires) {
      if (
        wireIndex >= this.circuitDefinition.numWires &&
        this.qubitDensityMatrix(colIndex, 0).hasNaN()
      ) {
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
  toReadableJson(includeOutputAmplitudes = true) {
    const result = {
      time_parameter: this.time,
      circuit: Serializer.toJson(this.circuitDefinition),
      chance_of_surviving_to_each_column: this._survivalRates,
      computed_bloch_vectors_by_column_then_wire: this._qubitDensities.map(
        (col) => col.map(singleQubitDensityMatrixToReadableJson),
      ),
      displays: this._customStatsToReadableJson(),
    };
    if (Object.keys(this.sampleOutcomes).length)
      result.sample_outcomes = this.sampleOutcomes;
    if (includeOutputAmplitudes) {
      result["output_amplitudes"] = ReadableJson.complexVector(
        this.finalState.getColumn(0),
      );
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
      densities: this._qubitDensities.map((col) =>
        col.map((m) => [...m.rawBuffer()]),
      ),
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
      let [col, row] = key.split(":");
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
        data,
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
    const key = `${col}:${row}`;
    return this._customStatsProcessed.has(key)
      ? this._customStatsProcessed.get(key)
      : undefined;
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
      this._customStatsProcessed,
      this.seed,
      this.sampleOutcomes,
    );
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
      new Map(),
    );
  }

  /**
   * @param {!CircuitDefinition} circuitDefinition
   * @param {!number} time
   * @param {*=} seed
   * @param {undefined|!StablePrefix=} prefix Where to take the state after the columns that do not move
   *     with time from, and to keep it, so that a circuit run again and again at different times
   *     applies only the columns that do.
   * @returns {!CircuitStats}
   */
  static fromCircuitAtTime(
    circuitDefinition,
    time,
    seed = undefined,
    prefix = undefined,
  ) {
    try {
      return CircuitStats._fromCircuitAtTime_noFallback(
        circuitDefinition,
        time,
        seed,
        prefix,
      );
    } catch (ex) {
      reportRecoveredError(
        `Defaulted to NaN results. Computing circuit values failed.`,
        { circuitDefinition: Serializer.toJson(circuitDefinition) },
        ex,
      );
      return CircuitStats.withNanDataFromCircuitAtTime(circuitDefinition, time);
    }
  }

  /**
   * The stats of the whole circuit and of just the columns the playhead has run, from one run: the
   * playhead's are the first columns' stats of the whole run, and the state it left when it had
   * applied them. A run apiece would apply those columns twice and wait on the GPU twice.
   *
   * The playhead's stats are what a run of its circuit alone gives, but for rounding.
   *
   * @param {!CircuitDefinition} circuitDefinition
   * @param {!CircuitDefinition} playhead The circuit with only the columns the playhead has run: the
   *     first `step` of the circuit's, for a step short of the circuit's end.
   * @param {!number} time
   * @param {*=} seed
   * @param {undefined|!StablePrefix=} prefix As for fromCircuitAtTime.
   * @returns {!{fullStats: !CircuitStats, stats: !CircuitStats}}
   */
  static fromCircuitAtTimeWithPlayhead(
    circuitDefinition,
    playhead,
    time,
    seed = undefined,
    prefix = undefined,
  ) {
    try {
      const wholeCircuit = circuitDefinition.withMinimumWireCount();
      const playheadCircuit = playhead.withMinimumWireCount();
      const run = runCircuit(wholeCircuit, time, seed, {
        prefix,
        step: playheadCircuit.columns.length,
        playheadWires: playheadCircuit.numWires,
      });
      const results = CircuitStats._fromRunPixels(
        wholeCircuit,
        playheadCircuit,
        time,
        seed,
        readRun(run),
      );
      // A run that began from a kept prefix, past the playhead, has no state to make its stats of.
      return {
        fullStats: results.fullStats,
        stats:
          results.stats ??
          CircuitStats._fromCircuitAtTime_noFallback(
            playheadCircuit,
            time,
            seed,
          ),
      };
    } catch (ex) {
      reportRecoveredError(
        `Defaulted to NaN results. Computing circuit values failed.`,
        { circuitDefinition: Serializer.toJson(circuitDefinition) },
        ex,
      );
      return {
        fullStats: CircuitStats.withNanDataFromCircuitAtTime(
          circuitDefinition,
          time,
        ),
        stats: CircuitStats.withNanDataFromCircuitAtTime(playhead, time),
      };
    }
  }

  /**
   * Starts working out the stats without waiting for the GPU, which is the slow part: the run is
   * issued and the results are read into buffers, and a later frame comes back for them. See
   * PendingCircuitStats.
   *
   * @param {!CircuitDefinition} circuitDefinition
   * @param {undefined|!CircuitDefinition} playhead As for fromCircuitAtTimeWithPlayhead, or undefined
   *     for the stats of the whole circuit alone.
   * @param {!number} time
   * @param {*=} seed
   * @param {undefined|!StablePrefix=} prefix As for fromCircuitAtTime.
   * @returns {!PendingCircuitStats}
   */
  static startFromCircuitAtTime(
    circuitDefinition,
    playhead,
    time,
    seed = undefined,
    prefix = undefined,
  ) {
    const wholeCircuit = circuitDefinition.withMinimumWireCount();
    const playheadCircuit = playhead?.withMinimumWireCount();
    try {
      const run = runCircuit(wholeCircuit, time, seed, {
        prefix,
        step: playheadCircuit?.columns.length,
        playheadWires: playheadCircuit?.numWires,
      });
      return new PendingCircuitStats(
        wholeCircuit,
        playheadCircuit,
        time,
        seed,
        startReadingRun(run),
      );
    } catch (ex) {
      return PendingCircuitStats.failed(
        wholeCircuit,
        playheadCircuit,
        time,
        ex,
      );
    }
  }

  /**
   * The state after each of the given numbers of columns: what a run of just those columns would
   * leave, at these stats' time and seed, renormalized by the chance of surviving to it as the final
   * state is. All of them come from one run of the circuit and one readback; a run per step would
   * apply the columns again for every step and wait on the GPU once per step.
   *
   * @param {!Array.<!int>} steps How many columns have run, each from 0 to the column count.
   * @param {undefined|!StablePrefix=} prefix As for fromCircuitAtTime, except that it is only read:
   *     when it holds the state after the columns that do not move for this circuit and seed, and no
   *     step is before them, the run starts there and applies only the columns after. The states are
   *     the same either way.
   * @param {undefined|!int=} wireCount How many qubits the states are over, when more than the
   *     circuit's own: the wires it leaves out stay |0>, so each state is zero after the amplitudes
   *     the circuit has. Default is the circuit's own.
   * @returns {!Array.<!Matrix>} The state after each, in the order asked.
   */
  statesAfterSteps(steps, prefix = undefined, wireCount = undefined) {
    const circuit = this.circuitDefinition.withMinimumWireCount();
    const numWires = circuit.numWires;
    const size = 1 << (wireCount ?? numWires);
    const wanted = [...new Set(steps)].sort((a, b) => a - b);
    if (wanted.length === 0) {
      return [];
    }
    let pixels;
    try {
      pixels = readStatesAfterSteps(
        circuit,
        this.time,
        this.seed,
        wanted,
        prefix,
      );
    } catch (ex) {
      reportRecoveredError(
        `Defaulted to NaN states. Computing the states after each step failed.`,
        { circuitDefinition: Serializer.toJson(circuit) },
        ex,
      );
      const nan = KetTextureUtil.pixelsToAmplitudes(
        new Float32Array(2 << numWires).fill(NaN),
        1,
        size,
      );
      return steps.map(() => nan);
    }
    const states = new Map(
      wanted.map((step, i) => [
        step,
        KetTextureUtil.pixelsToAmplitudes(
          pixels[i],
          this.survivalRate(step - 1),
          size,
        ),
      ]),
    );
    return steps.map((step) => states.get(step));
  }

  /**
   * Returns the same density matrix, but without off-diagonal terms connecting different measured-bit values.
   * @param {!Matrix} densityMatrix
   * @param {!int} isMeasuredMask A bitmask where each 1 corresponds to a measured qubit position.
   * @returns {!Matrix}
   */
  static decohereMeasuredBitsInDensityMatrix(densityMatrix, isMeasuredMask) {
    return decohereMeasuredBitsInDensityMatrix(densityMatrix, isMeasuredMask);
  }

  /**
   * @param {!Array.<!Matrix>} rawMatrices
   * @param {!int} numWires
   * @param {!int} qubitSpan
   * @param {!int} isMeasuredMask
   * @param {!int} hasDisplayMask
   * @returns {!Array.<!Matrix>}
   */
  static scatterAndDecohereDensities(
    rawMatrices,
    numWires,
    qubitSpan,
    isMeasuredMask,
    hasDisplayMask,
  ) {
    const nanMatrix = Matrix.zero(1 << qubitSpan, 1 << qubitSpan).times(NaN);
    let used = 0;
    const result = [];
    for (let row = 0; row < numWires - qubitSpan + 1; row++) {
      if ((hasDisplayMask & (1 << row)) === 0) {
        result.push(nanMatrix);
      } else {
        result.push(
          CircuitStats.decohereMeasuredBitsInDensityMatrix(
            rawMatrices[used++],
            (isMeasuredMask >> row) & ((1 << qubitSpan) - 1),
          ),
        );
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
  static _extractColumnQubitStatsFromPixelDatas(
    circuitDefinition,
    colQubitDensitiesPixelData,
  ) {
    const qubitDensityGrid = [];
    for (let col = 0; col < colQubitDensitiesPixelData.length; col++) {
      const dataHasStatsMask =
        col === circuitDefinition.columns.length
          ? -1 // All wires have an output display in the after-last column.
          : circuitDefinition.colDesiredSingleQubitStatsMask(col);
      qubitDensityGrid.push(
        CircuitStats.scatterAndDecohereDensities(
          KetTextureUtil.pixelsToQubitDensityMatrices(
            colQubitDensitiesPixelData[col],
          ),
          circuitDefinition.numWires,
          1,
          circuitDefinition.colIsMeasuredMask(col),
          dataHasStatsMask,
        ),
      );
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
   * @param {*=} seed
   * @param {undefined|!StablePrefix=} prefix
   * @returns {!CircuitStats}
   */
  static _fromCircuitAtTime_noFallback(
    circuitDefinition,
    time,
    seed = undefined,
    prefix = undefined,
  ) {
    circuitDefinition = circuitDefinition.withMinimumWireCount();
    const run = runCircuit(circuitDefinition, time, seed, { prefix });
    return CircuitStats._fromPixels(
      circuitDefinition,
      time,
      seed,
      readRun(run),
    );
  }

  /**
   * The stats of a run, and of its playhead's circuit if the run kept the state there, made from the
   * pixels it read.
   *
   * @param {!CircuitDefinition} circuitDefinition With its minimum wire count.
   * @param {undefined|!CircuitDefinition} playhead With its minimum wire count.
   * @param {!number} time
   * @param {*} seed
   * @param {!RunPixels} pixels
   * @returns {!{fullStats: !CircuitStats, stats: (undefined|!CircuitStats)}}
   * @private
   */
  static _fromRunPixels(circuitDefinition, playhead, time, seed, pixels) {
    return {
      fullStats: CircuitStats._fromPixels(
        circuitDefinition,
        time,
        seed,
        pixels,
      ),
      stats:
        playhead === undefined || pixels.playhead === undefined
          ? undefined
          : CircuitStats._fromPixels(
              playhead,
              time,
              seed,
              playheadPixels(pixels, playhead),
            ),
    };
  }

  /**
   * @param {!CircuitDefinition} circuitDefinition With its minimum wire count.
   * @param {!number} time
   * @param {*} seed
   * @param {!RunPixels} pixelData
   * @returns {!CircuitStats}
   * @private
   */
  static _fromPixels(circuitDefinition, time, seed, pixelData) {
    const qubitDensities = CircuitStats._extractColumnQubitStatsFromPixelDatas(
      circuitDefinition,
      pixelData.colQubitDensities,
    );
    const survivalRates =
      CircuitStats._extractColumnSurvivalRateStatsFromPixelDatas(
        pixelData.colNorms,
      );
    const outputSuperposition = KetTextureUtil.pixelsToAmplitudes(
      pixelData.output,
      survivalRates.length === 0 ? 1 : survivalRates.at(-1),
    );

    const customStatsProcessed = processCustomStats(
      circuitDefinition,
      pixelData.customStatsMap,
      pixelData.customStats,
    );
    const sampleOutcomes = collectSampleOutcomes(
      circuitDefinition,
      customStatsProcessed,
      time,
      seed,
    );
    return new CircuitStats(
      circuitDefinition,
      time,
      survivalRates,
      qubitDensities,
      outputSuperposition,
      customStatsProcessed,
      seed,
      sampleOutcomes,
    );
  }
}

/**
 * The pixels the stats of a playhead's circuit are made of, out of those of a run of the whole circuit.
 * Its columns are the first of the circuit's, so their stats are the first of the run's. Its state is
 * the one the run kept when it had applied them, which the wires the playhead's circuit leaves out
 * left at |0>, so that its amplitudes are the first of the kept state's.
 *
 * @param {!RunPixels} pixels Of a run that kept the playhead's state.
 * @param {!CircuitDefinition} playhead With its minimum wire count.
 * @returns {!RunPixels}
 */
function playheadPixels(pixels, playhead) {
  const step = playhead.columns.length;
  return {
    colNorms: pixels.colNorms.slice(0, step),
    colQubitDensities: [
      ...pixels.colQubitDensities.slice(0, step),
      pixels.playhead.densities,
    ],
    customStats: pixels.customStats,
    customStatsMap: pixels.customStatsMap.filter(({ col }) => col < step),
    output: pixels.playhead.state.subarray(0, 2 << playhead.numWires),
    playhead: undefined,
  };
}

/**
 * Stats being worked out by a run that did not wait for the GPU. Ask `poll` each frame until the
 * results are there, or `cancel` if they are no longer wanted.
 */
class PendingCircuitStats {
  /**
   * @param {!CircuitDefinition} circuitDefinition With its minimum wire count.
   * @param {undefined|!CircuitDefinition} playhead With its minimum wire count.
   * @param {!number} time
   * @param {*} seed
   * @param {undefined|!{poll: !function(): (undefined|!RunPixels), cancel: !function(): void}} pending
   */
  constructor(circuitDefinition, playhead, time, seed, pending) {
    /** @private */
    this._circuitDefinition = circuitDefinition;
    /** @private */
    this._playhead = playhead;
    /** @private */
    this._time = time;
    /** @private */
    this._seed = seed;
    /** @private */
    this._pending = pending;
    /**
     * @type {undefined|!{fullStats: !CircuitStats, stats: (undefined|!CircuitStats)}}
     * @private
     */
    this._result = undefined;
  }

  /**
   * A run that never started, whose stats are NaN as a failed run's are.
   *
   * @param {!CircuitDefinition} circuitDefinition
   * @param {undefined|!CircuitDefinition} playhead
   * @param {!number} time
   * @param {*} cause
   * @returns {!PendingCircuitStats}
   */
  static failed(circuitDefinition, playhead, time, cause) {
    const result = new PendingCircuitStats(
      circuitDefinition,
      playhead,
      time,
      undefined,
      undefined,
    );
    result._result = result._nanResult(cause);
    return result;
  }

  /**
   * @param {*} cause
   * @returns {!{fullStats: !CircuitStats, stats: (undefined|!CircuitStats)}}
   * @private
   */
  _nanResult(cause) {
    reportRecoveredError(
      `Defaulted to NaN results. Computing circuit values failed.`,
      { circuitDefinition: Serializer.toJson(this._circuitDefinition) },
      cause,
    );
    return {
      fullStats: CircuitStats.withNanDataFromCircuitAtTime(
        this._circuitDefinition,
        this._time,
      ),
      stats:
        this._playhead === undefined
          ? undefined
          : CircuitStats.withNanDataFromCircuitAtTime(
              this._playhead,
              this._time,
            ),
    };
  }

  /**
   * @returns {undefined|!{fullStats: !CircuitStats, stats: (undefined|!CircuitStats)}} The stats once
   *     the GPU has got that far, and the same ones if asked again; undefined until then. `stats`,
   *     the playhead's, is undefined if none was asked for, or the run had no state of it to make
   *     them from. They are NaN, as for a run that fails, if turning the pixels into stats fails.
   * @throws {!DetailedError} If the context was lost meanwhile; nothing is left to read.
   */
  poll() {
    if (this._result === undefined) {
      const pixels = this._pending.poll();
      if (pixels === undefined) {
        return undefined;
      }
      try {
        this._result = CircuitStats._fromRunPixels(
          this._circuitDefinition,
          this._playhead,
          this._time,
          this._seed,
          pixels,
        );
      } catch (ex) {
        this._result = this._nanResult(ex);
      }
    }
    return this._result;
  }

  /** Gives up on the stats, freeing what the run holds. */
  cancel() {
    this._pending?.cancel();
  }
}

/** Converts each custom display texture using its gate's postprocessor, in evaluation order. */
function processCustomStats(
  circuitDefinition,
  customStatsMap,
  customStatsPixelData,
) {
  const customStatsProcessed = new Map();
  for (const { col, row, out } of customStatsMap) {
    const func =
      circuitDefinition.gateInSlot(col, row).customStatPostProcesser ||
      ((e) => e);
    customStatsProcessed.set(
      `${col}:${row}`,
      func(customStatsPixelData[out], circuitDefinition, col, row),
    );
  }
  return customStatsProcessed;
}

/** Records Sample outcomes using a separate random stream for each display location. */
function collectSampleOutcomes(
  circuitDefinition,
  customStatsProcessed,
  time,
  seed,
) {
  const sampleOutcomes = {};
  for (const [location, data] of customStatsProcessed) {
    const [col, row] = location.split(":").map(Number);
    if (
      !/^Sample\d+$/.test(circuitDefinition.gateInSlot(col, row).serializedId)
    ) {
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
      return { i, p: buf[i * 2] };
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
  return { x, y, z };
}

CircuitStats.EMPTY = CircuitStats.withNanDataFromCircuitAtTime(
  CircuitDefinition.EMPTY,
  0,
);

export { CircuitStats };
