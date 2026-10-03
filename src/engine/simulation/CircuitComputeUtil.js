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
import { KetTextureUtil } from "./gpu/KetTextureUtil.js";
import { Controls } from "../../circuit/model/Controls.js";
/** @typedef {import("../../circuit/model/Gate.js").GateBuilder} GateBuilder */
import { mergeMaps } from "../../base/maps.js";

/**
 * @param {!GateBuilder} builder
 * @param {!CircuitDefinition} circuitDefinition
 * @returns {!GateBuilder}
 */
function setGateBuilderEffectToCircuit(builder, circuitDefinition) {
  return builder
    .setActualEffectToUpdateFunc((ctx) =>
      advanceStateWithCircuit(
        ctx,
        circuitDefinition.withDisabledReasonsForEmbeddedContext(
          ctx.row,
          ctx.customContextFromGates,
        ),
        false,
      ),
    )
    .setKnownEffectToCircuit(circuitDefinition)
    .setExtraDisableReasonFinder((args) => {
      const def = circuitDefinition.withDisabledReasonsForEmbeddedContext(
        args.outerRow,
        args.context,
      );
      for (let row = 0; row < def.numWires; row++) {
        for (let col = 0; col < def.columns.length; col++) {
          const r = def.gateAtLocIsDisabledReason(col, row);
          if (r !== undefined) {
            return r;
          }
          if (def.gateInSlot(col, row)?.measureEffect === "measure") {
            return "hidden\nmeasure\nbroken";
          }
        }
      }
      return undefined;
    });
}

/**
 * @param {!CircuitEvalContext} ctx
 * @param {!CircuitDefinition} circuitDefinition
 * @param {!boolean} collectStats
 * @param {undefined|!function(!int, !CircuitEvalContext, !Object): void} afterStep Called with how many
 *     columns have run - `firstColumn` once the run starts, which is 0 after the initial state is
 *     set, then after each column - while the state trader holds the state at that step. The third
 *     argument is the stats collected so far, in the shape this function returns them.
 * @param {!int=} firstColumn Where to start. Past 0 the state trader already holds the state after
 *     that many columns, so neither the initial state nor those columns are applied, and the stats
 *     come only from the columns that are.
 * @throws If a column fails. The stats collected up to then go back to the pool, and the state trader
 *     is left holding the state it has, for the caller to give back.
 * @returns {!{
 *     colQubitDensities: !Array.<!WglTexture>,
 *     colNorms: !Array.<!WglTexture>,
 *     customStats: !Array.<*>,
 *     customStatsMap: !Array.<*>
 * }}
 */
function advanceStateWithCircuit(ctx, circuitDefinition, collectStats, afterStep = undefined, firstColumn = 0) {
  // Prep stats collection.
  const colQubitDensities = [];
  const customStats = [];
  const colNorms = [];
  const customStatsMap = [];
  const statsCallback = (col) => (statArgs) => {
    if (!collectStats) {
      return;
    }

    const { qubitDensities, norm, customGateStats } =
      _extractStateStatsNeededByCircuitColumn(statArgs, circuitDefinition, col);
    colQubitDensities.push(qubitDensities);
    colNorms.push(norm);
    for (const { row, stat } of customGateStats) {
      customStatsMap.push({ col, row, out: customStats.length });
      customStats.push(stat);
    }
  };

  const collected = {
    colQubitDensities,
    colNorms,
    customStats,
    customStatsMap,
  };
  try {
    if (firstColumn === 0) {
      circuitDefinition.applyInitialStateOperations(ctx);
    }
    afterStep?.(firstColumn, ctx, collected);

    // Apply each column in the circuit.
    for (let col = firstColumn; col < circuitDefinition.columns.length; col++) {
      _advanceStateWithCircuitDefinitionColumn(
        ctx,
        circuitDefinition,
        col,
        statsCallback(col),
      );
      afterStep?.(col + 1, ctx, collected);
    }

    if (collectStats) {
      const allWiresMask = (1 << circuitDefinition.numWires) - 1;
      colQubitDensities.push(
        KetTextureUtil.superpositionToQubitDensities(
          ctx.stateTrader.currentTexture,
          Controls.NONE,
          allWiresMask,
        ),
      );
    }
  } catch (ex) {
    // The caller only gets the stats of a run that finished, so a failed one is the last to hold them.
    // The state is the caller's: it is in the trader the caller gave.
    for (const texture of [...colQubitDensities, ...colNorms, ...customStats.flat()]) {
      texture.deallocByDepositingInPool("stat collected by a run that failed");
    }
    throw ex;
  }

  return collected;
}

/**
 * @param {!CircuitEvalContext} ctx
 * @param {!CircuitDefinition} circuitDefinition
 * @param {!int} col
 * @private
 * @returns {!{
 *     qubitDensities: !WglTexture,
 *     norm: !WglTexture,
 *     customGateStats: !Array.<!{row: !int, stat: !WglTexture}>
 * }}
 */
function _extractStateStatsNeededByCircuitColumn(ctx, circuitDefinition, col) {
  // What this column's stats have taken so far, to give back if a later one fails.
  const made = [];
  try {
    // Compute custom stats used by display gates.
    const customGateStats = [];
    for (const row of circuitDefinition.customStatRowsInCol(col)) {
      const statCtx = new CircuitEvalContext(
        ctx.time,
        row,
        circuitDefinition.numWires,
        ctx.controls,
        ctx.controlsTexture,
        ctx.controls,
        ctx.stateTrader,
        mergeMaps(
          ctx.customContextFromGates,
          circuitDefinition.colCustomContextFromGates(col, row),
        ),
        ctx.random,
      );
      const stat =
        circuitDefinition.columns[col].gates[row].customStatTexturesMaker(
          statCtx,
        );
      made.push(stat);
      customGateStats.push({ row, stat });
    }

    // Compute individual qubit densities, where needed.
    const qubitDensities = KetTextureUtil.superpositionToQubitDensities(
      ctx.stateTrader.currentTexture,
      ctx.controls,
      circuitDefinition.colDesiredSingleQubitStatsMask(col),
    );
    made.push(qubitDensities);

    // Compute survival rate.
    const normMayHaveChanged =
      circuitDefinition.columns[col].indexOfNonUnitaryGate() !== undefined;
    const norm = KetTextureUtil.superpositionToNorm(
      ctx.stateTrader.currentTexture,
      normMayHaveChanged,
    );

    return { qubitDensities, norm, customGateStats };
  } catch (ex) {
    for (const texture of made.flat()) {
      texture.deallocByDepositingInPool("stat of a column that failed");
    }
    throw ex;
  }
}

/**
 * Advances the state trader inside of the given CircuitEvalContext.
 *
 * @param {!CircuitEvalContext} ctx Evaluation arguments, including the row this column starts at (for when the circuit
 *                                  we're applying is actually a gate embedded inside an outer circuit).
 * @param {!CircuitDefinition} circuitDefinition
 * @param {!int} col
 * @param {!function(!CircuitEvalContext)} statsCallback
 * @returns {void}
 * @private
 */
function _advanceStateWithCircuitDefinitionColumn(
  ctx,
  circuitDefinition,
  col,
  statsCallback,
) {
  const controls = ctx.controls.and(
    circuitDefinition.colControls(col).shift(ctx.row),
  );
  const controlTex = CircuitShaders.controlMask(controls).toBoolTexture(
    ctx.wireCount,
  );

  const colContext = mergeMaps(
    ctx.customContextFromGates,
    circuitDefinition.colCustomContextFromGates(col, ctx.row),
  );

  const trader = ctx.stateTrader;
  const aroundCtx = new CircuitEvalContext(
    ctx.time,
    ctx.row,
    ctx.wireCount,
    ctx.controls,
    ctx.controlsTexture,
    controls,
    trader,
    colContext,
    ctx.random,
  );
  const mainCtx = new CircuitEvalContext(
    ctx.time,
    ctx.row,
    ctx.wireCount,
    controls,
    controlTex,
    controls,
    trader,
    colContext,
    ctx.random,
  );

  try {
    circuitDefinition.applyBeforeOperationsInCol(col, aroundCtx);
    circuitDefinition.applyMainOperationsInCol(col, mainCtx);
    statsCallback(mainCtx);
    circuitDefinition.applyAfterOperationsInCol(col, aroundCtx);
  } finally {
    controlTex.deallocByDepositingInPool(
      "controlTex in _advanceStateWithCircuitDefinitionColumn",
    );
  }
}

export { setGateBuilderEffectToCircuit, advanceStateWithCircuit };
