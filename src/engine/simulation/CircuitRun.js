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

import { CircuitEvalContext } from "./CircuitEvalContext.js";
import { CircuitShaders } from "./gpu/CircuitShaders.js";
import { Controls } from "../../circuit/model/Controls.js";
import { KetTextureUtil } from "./gpu/KetTextureUtil.js";
import { Shaders } from "../webgl/operations/Shaders.js";
import { StablePrefix } from "./StablePrefix.js";
import { advanceStateWithCircuit } from "./CircuitComputeUtil.js";
import { currentShaderCoder } from "../webgl/coder/ShaderCoders.js";
import { initializedWglContext } from "../webgl/context/WglContext.js";
import { WglTextureTrader } from "../webgl/texture/WglTextureTrader.js";
import { WglTexturePool } from "../webgl/texture/WglTexturePool.js";
import { randomFor } from "./random.js";

/**
 * One run of a circuit on the GPU, and the reading of what it leaves.
 *
 * Running comes first and leaves textures: the final state, and the stats of every column, which
 * the GPU worked out from the state as it passed. Reading comes second and is the slow part, since
 * the GPU does its work when the results are asked for. It can wait for the GPU (`readRun`) or come
 * back for the results later (`startReadingRun`). Turning the pixels into CircuitStats is the job of
 * CircuitStats.
 *
 * A run can start part way, from the state a StablePrefix kept, and can stop to keep a copy of the
 * state at a column the playhead stands on, so that one run serves the whole circuit and the part
 * of it that has run.
 */

/**
 * What a run read, in the shape CircuitStats makes its stats from: the pixels of every column's stats,
 * for the columns kept from before the run as well as those it ran.
 *
 * @typedef {!{
 *     colNorms: !Array.<!Float32Array>,
 *     colQubitDensities: !Array.<!Float32Array>,
 *     customStats: !Array.<!Float32Array|!Array.<!Float32Array>>,
 *     customStatsMap: !Array.<!{col: !int, row: !int, out: !int}>,
 *     output: !Float32Array,
 *     playhead: (undefined|!{state: !Float32Array, densities: !Float32Array})
 * }} RunPixels
 *     `output` is the final state, two amplitudes to a pixel. `playhead` is the state at the step the
 *     run was asked to stop at, in the same layout and over all the wires, and the qubit densities of
 *     the wires the playhead's circuit has.
 */

/**
 * A copy of a state texture, to run on or to keep, leaving the state itself to the run.
 *
 * @param {!WglTexture} state
 * @returns {!WglTexture}
 */
function stateCopy(state) {
  const copy = WglTexturePool.takeSame(state);
  Shaders.passthrough(state).renderToElseDealloc(copy);
  return copy;
}

/**
 * A copy of a state texture in the layout a readback takes, two amplitudes to a pixel, leaving the
 * state itself to the run.
 *
 * @param {!WglTexture} state
 * @returns {!WglTexture}
 */
function packedStateCopy(state) {
  if (!currentShaderCoder().vec2.needRearrangingToBeInVec4Format) {
    return stateCopy(state);
  }
  const copy = WglTexturePool.take(
    Math.max(0, state.sizePower() - 1),
    state.pixelType,
  );
  Shaders.packVec2IntoVec4(state).renderToElseDealloc(copy);
  return copy;
}

/**
 * A new evaluation context for a run, with the state in a trader of its own.
 *
 * @param {!number} time
 * @param {!int} numWires
 * @param {!WglTexture} controlTex
 * @param {!WglTexture} state
 * @param {!function(): !number} random
 * @returns {!CircuitEvalContext}
 */
function topLevelContext(time, numWires, controlTex, state, random) {
  return new CircuitEvalContext(
    time,
    0,
    numWires,
    Controls.NONE,
    controlTex,
    Controls.NONE,
    new WglTextureTrader(state),
    new Map(),
    random,
  );
}

/**
 * Runs the circuit once, and leaves what its stats are read from.
 *
 * Given a StablePrefix, the run starts from the state it keeps after the columns that do not move
 * with time, if it keeps the right one, and applies only the columns from there. If it does not, the
 * run is the whole circuit, and makes a copy of the state at that point for the prefix to keep once
 * the stats have been read - unless the columns drew random numbers, which no later run could
 * reproduce from the middle.
 *
 * @param {!CircuitDefinition} circuit With its minimum wire count.
 * @param {!number} time
 * @param {*} seed
 * @param {undefined|!{prefix: (undefined|!StablePrefix), step: (undefined|!int), playheadWires: (undefined|!int)}} options
 *     `prefix` is where to take the state after the columns that do not move from, and to keep it.
 *     `step` is how many columns the playhead has run, when it stands inside the circuit and a copy of
 *     the state there is wanted, and `playheadWires` how many wires its circuit has. When the run starts
 *     past `step` it cannot make the copy, and the run's `playhead` is undefined.
 * @returns {!CircuitRun}
 *
 * @typedef {!{
 *     circuit: !CircuitDefinition,
 *     seed: *,
 *     prefix: (undefined|!StablePrefix),
 *     lifetime: !int,
 *     known: (undefined|!KeptPrefix),
 *     output: !WglTexture,
 *     colQubitDensities: !Array.<!WglTexture>,
 *     colNorms: !Array.<!WglTexture>,
 *     customStats: !Array.<!WglTexture|!Array.<!WglTexture>>,
 *     customStatsMap: !Array.<!{col: !int, row: !int, out: !int}>,
 *     playhead: (undefined|!{state: !WglTexture, densities: !WglTexture}),
 *     keep: (undefined|!{state: (undefined|!WglTexture), norms: !int, densities: !int, customs: !int, mapped: !int})
 * }} CircuitRun
 *     `known` is the kept prefix the run started from, whose stats it does not repeat. `keep` says
 *     what to keep when the run is read: a copy of the state, and how many of the stats are the prefix's;
 *     with no state, that the prefix is to be kept as not kept.
 */
function runCircuit(
  circuit,
  time,
  seed,
  { prefix = undefined, step = undefined, playheadWires = undefined } = {},
) {
  const numWires = circuit.numWires;
  const lifetime = initializedWglContext().lifetimeCounter;

  const keptLength =
    prefix === undefined ? 0 : StablePrefix.keptLength(circuit);
  if (keptLength === 0) {
    prefix?.release();
  }
  const held =
    keptLength === 0 ? undefined : prefix.heldFor(circuit, seed, keptLength);
  const known = held?.state === undefined ? undefined : held;
  const toKeep = keptLength > 0 && held === undefined;

  // A prefix that drew random numbers cannot be started from, and is told apart by counting them.
  let draws = 0;
  const source = seed === undefined ? Math.random : randomFor(seed);
  const random = () => {
    draws++;
    return source();
  };

  const controlTex = CircuitShaders.controlMask(Controls.NONE).toBoolTexture(
    numWires,
  );
  const ctx = topLevelContext(
    time,
    numWires,
    controlTex,
    known === undefined
      ? CircuitShaders.classicalState(0).toVec2Texture(numWires)
      : stateCopy(known.state),
    random,
  );
  const run = {
    circuit,
    seed,
    prefix,
    lifetime,
    known,
    colQubitDensities: [],
    colNorms: [],
    customStats: [],
    customStatsMap: [],
    playhead: undefined,
    keep: undefined,
  };
  const afterStep = (reached, { stateTrader }, collected) => {
    if (toKeep && reached === keptLength) {
      run.keep =
        draws > 0
          ? { state: undefined, norms: 0, densities: 0, customs: 0, mapped: 0 }
          : {
              state: stateCopy(stateTrader.currentTexture),
              norms: collected.colNorms.length,
              densities: collected.colQubitDensities.length,
              customs: collected.customStats.length,
              mapped: collected.customStatsMap.length,
            };
    }
    if (reached === step) {
      const state = packedStateCopy(stateTrader.currentTexture);
      try {
        run.playhead = {
          state,
          densities: KetTextureUtil.superpositionToQubitDensities(
            stateTrader.currentTexture,
            Controls.NONE,
            (1 << playheadWires) - 1,
          ),
        };
      } catch (ex) {
        state.deallocByDepositingInPool(
          "playhead state, from a run that failed",
        );
        throw ex;
      }
    }
  };

  try {
    Object.assign(
      run,
      advanceStateWithCircuit(
        ctx,
        circuit,
        true,
        afterStep,
        known?.length ?? 0,
        // Fused runs end at the prefix to keep and at the playhead, whose states afterStep copies.
        {
          stopBefore: (col) => (toKeep && col === keptLength) || col === step,
        },
      ),
    );
    if (currentShaderCoder().vec2.needRearrangingToBeInVec4Format) {
      ctx.stateTrader.shadeHalveAndTrade(Shaders.packVec2IntoVec4);
    }
  } catch (ex) {
    abandonRun(run, ctx.stateTrader.currentTexture);
    throw ex;
  } finally {
    controlTex.deallocByDepositingInPool("controlTex in runCircuit");
  }
  run.output = ctx.stateTrader.currentTexture;
  return run;
}

/**
 * Gives back the copy of the state that a run was to keep, if it still has it. A run is read from
 * its textures, which the read gives back itself; the copy is the one thing it holds apart.
 *
 * @param {!CircuitRun} run
 */
function releaseKept(run) {
  run.keep?.state?.deallocByDepositingInPool(
    "state to keep, from a run that did not finish",
  );
  run.keep = undefined;
}

/**
 * Gives back the textures of a run that failed and is not going to be read: the state it was left
 * holding, the stats it had collected, and the copies it had made for the playhead and the prefix.
 * Whatever the run had not yet taken, it did not.
 *
 * @param {!CircuitRun} run Without an `output`, which it only has once it has finished.
 * @param {!WglTexture} state The one the run's trader holds, whichever step it failed at.
 */
function abandonRun(run, state) {
  releaseKept(run);
  run.playhead?.state.deallocByDepositingInPool(
    "playhead state, from a run that failed",
  );
  run.playhead?.densities.deallocByDepositingInPool(
    "playhead densities, from a run that failed",
  );
  run.playhead = undefined;
  for (const texture of [
    ...run.colNorms,
    ...run.colQubitDensities,
    ...run.customStats.flat(),
  ]) {
    texture.deallocByDepositingInPool("stat from a run that failed");
  }
  state.deallocByDepositingInPool("state from a run that failed");
}

/**
 * @param {!CircuitRun} run
 * @returns {!Array.<!WglTexture>} Every texture to read, in the order runPixels hands them out.
 */
function texturesToRead(run) {
  return [
    ...run.colNorms,
    ...run.colQubitDensities,
    ...run.customStats.flat(),
    run.output,
    ...(run.playhead === undefined
      ? []
      : [run.playhead.state, run.playhead.densities]),
  ];
}

/**
 * Hands out the pixels read, in the order the textures were given, as what they are the pixels of.
 * Keeps the first columns' stats in the prefix, if the run was to, and puts the stats of the kept
 * prefix before those the run read.
 *
 * @param {!CircuitRun} run
 * @param {!Array.<!Float32Array>} pixels
 * @returns {!RunPixels}
 */
function runPixels(run, pixels) {
  const next = pixels[Symbol.iterator]();
  const take = () => next.next().value;
  const ran = {
    colNorms: run.colNorms.map(take),
    colQubitDensities: run.colQubitDensities.map(take),
    customStats: run.customStats.map((stat) =>
      Array.isArray(stat) ? stat.map(take) : take(),
    ),
    customStatsMap: run.customStatsMap,
    output: take(),
    playhead:
      run.playhead === undefined
        ? undefined
        : { state: take(), densities: take() },
  };
  keepPrefix(run, ran);

  const known = run.known;
  if (known === undefined) {
    return ran;
  }
  return {
    colNorms: [...known.colNorms, ...ran.colNorms],
    colQubitDensities: [...known.colQubitDensities, ...ran.colQubitDensities],
    customStats: [...known.customStats, ...ran.customStats],
    customStatsMap: [
      ...known.customStatsMap,
      ...ran.customStatsMap.map(({ col, row, out }) => ({
        col,
        row,
        out: out + known.customStats.length,
      })),
    ],
    output: ran.output,
    playhead: ran.playhead,
  };
}

/**
 * Passes what the run found out about its first columns to the prefix it was given, now that their
 * stats have been read.
 *
 * @param {!CircuitRun} run
 * @param {!RunPixels} ran
 */
function keepPrefix(run, ran) {
  const keep = run.keep;
  run.keep = undefined;
  if (keep === undefined) {
    return;
  }
  // Whatever the context lost, the copy of the state died with it.
  if (initializedWglContext().lifetimeCounter !== run.lifetime) {
    keep.state?.deallocByDepositingInPool(
      "state to keep, from before the context was lost",
    );
    return;
  }
  if (keep.state === undefined) {
    run.prefix.keepNothing(run.circuit, run.seed);
    return;
  }
  const copy = (array) => array.slice();
  run.prefix.keep(run.circuit, run.seed, {
    state: keep.state,
    colNorms: ran.colNorms.slice(0, keep.norms).map(copy),
    colQubitDensities: ran.colQubitDensities.slice(0, keep.densities).map(copy),
    customStats: ran.customStats
      .slice(0, keep.customs)
      .map((stat) => (Array.isArray(stat) ? stat.map(copy) : copy(stat))),
    customStatsMap: ran.customStatsMap.slice(0, keep.mapped),
  });
}

/**
 * Reads what a run left, waiting for the GPU to finish. The run's textures go back to the pool.
 *
 * @param {!CircuitRun} run
 * @returns {!RunPixels}
 */
function readRun(run) {
  return runPixels(run, KetTextureUtil.mergedReadFloats(texturesToRead(run)));
}

/**
 * A read of a run that has not waited for the GPU.
 */
class PendingRun {
  /**
   * @param {!CircuitRun} run
   * @param {!{poll: !function(): (undefined|!Array.<!Float32Array>), cancel: !function(): void}} read
   */
  constructor(run, read) {
    /** @private */
    this._run = run;
    /** @private */
    this._read = read;
    /**
     * @type {undefined|!RunPixels}
     * @private
     */
    this._pixels = undefined;
  }

  /**
   * @returns {undefined|!RunPixels} What readRun would have returned, once the GPU has got that
   *     far; undefined until then.
   * @throws {!DetailedError} If the context was lost meanwhile.
   */
  poll() {
    if (this._pixels === undefined) {
      let read;
      try {
        read = this._read.poll();
      } catch (ex) {
        releaseKept(this._run);
        throw ex;
      }
      if (read === undefined) {
        return undefined;
      }
      this._pixels = runPixels(this._run, read);
    }
    return this._pixels;
  }

  /** Gives up on the run, freeing what it holds. */
  cancel() {
    this._read.cancel();
    releaseKept(this._run);
  }
}

/**
 * Starts reading what a run left, without waiting for the GPU. The run's textures go back to the
 * pool at once, since the reads are queued behind the work that drew them.
 *
 * @param {!CircuitRun} run
 * @returns {!PendingRun}
 */
function startReadingRun(run) {
  let read;
  try {
    read = KetTextureUtil.startMergedReadFloats(texturesToRead(run));
  } catch (ex) {
    // The read gives back every texture it was given, even when it fails.
    releaseKept(run);
    throw ex;
  }
  return new PendingRun(run, read);
}

/**
 * Runs the circuit once, keeping a packed copy of the state at each wanted step, and reads the
 * copies back together.
 *
 * Given a StablePrefix that holds the state after the columns that do not move with time for this
 * circuit and seed, the run starts there, and applies only the columns after them. A prefix keeps
 * the state at its last column alone, so this holds only when no wanted step is before it; a step
 * before it needs the run from the start, as when there is no prefix. The prefix is only read, never
 * made or changed here: that is for the runs of the stats.
 *
 * @param {!CircuitDefinition} circuitDefinition With its minimum wire count.
 * @param {!number} time
 * @param {*} seed
 * @param {!Array.<!int>} steps Ascending, without repeats.
 * @param {undefined|!StablePrefix=} prefix
 * @returns {!Array.<!Float32Array>} Each step's amplitudes, interleaved real and imaginary.
 */
function readStatesAfterSteps(
  circuitDefinition,
  time,
  seed,
  steps,
  prefix = undefined,
) {
  const numWires = circuitDefinition.numWires;
  const wanted = new Set(steps);
  const keptLength =
    prefix === undefined ? 0 : StablePrefix.keptLength(circuitDefinition);
  const held =
    keptLength === 0
      ? undefined
      : prefix.heldFor(circuitDefinition, seed, keptLength);
  const known =
    held?.state !== undefined && steps[0] >= held.length ? held : undefined;

  const copies = [];
  const controlTex = CircuitShaders.controlMask(Controls.NONE).toBoolTexture(
    numWires,
  );
  const ctx = topLevelContext(
    time,
    numWires,
    controlTex,
    known === undefined
      ? CircuitShaders.classicalState(0).toVec2Texture(numWires)
      : stateCopy(known.state),
    seed === undefined ? Math.random : randomFor(seed),
  );
  try {
    advanceStateWithCircuit(
      ctx,
      circuitDefinition,
      false,
      (step, { stateTrader }) => {
        if (wanted.has(step)) {
          copies.push(packedStateCopy(stateTrader.currentTexture));
        }
      },
      known?.length ?? 0,
      // Fused runs end at every step whose state is read.
      { stopBefore: (col) => wanted.has(col) },
    );
  } catch (ex) {
    for (const copy of copies)
      copy.deallocByDepositingInPool("state copy after a failed run");
    throw ex;
  } finally {
    controlTex.deallocByDepositingInPool("controlTex in readStatesAfterSteps");
    ctx.stateTrader.currentTexture.deallocByDepositingInPool(
      "state in readStatesAfterSteps",
    );
  }
  return KetTextureUtil.mergedReadFloats(copies);
}

export { runCircuit, readRun, startReadingRun, readStatesAfterSteps };
