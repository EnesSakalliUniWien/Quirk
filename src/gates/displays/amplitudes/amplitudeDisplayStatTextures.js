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

import { CircuitShaders } from "../../../engine/simulation/gpu/CircuitShaders.js";
import { GateShaders } from "../../../engine/simulation/gpu/GateShaders.js";
import { probabilityStatTexture } from "../probability/probabilityStatTexture.js";
import { numberOfSetBits } from "../../../engine/math/bitOperations.js";
import { Shaders } from "../../../engine/webgl/operations/Shaders.js";
import { currentShaderCoder } from "../../../engine/webgl/coder/ShaderCoders.js";
import { WglTexturePool } from "../../../engine/webgl/texture/WglTexturePool.js";
import { WglTextureTrader } from "../../../engine/webgl/texture/WglTextureTrader.js";
import { AMPS_TO_SQUARED_MAGS_SHADER } from "./shaders/ampsToSquaredMagsShader.js";
import { MAGS_TO_INDEXED_MAGS_SHADER } from "./shaders/magsToIndexedMagsShader.js";
import { FOLD_MAX_INDEXED_MAG_SHADER } from "./shaders/foldMaxIndexedMagShader.js";
import { LOOKUP_KET_AT_INDEXED_MAG_SHADER } from "./shaders/lookupKetAtIndexedMagShader.js";
import { POINTWISE_CMUL_CONJ_SHADER } from "./shaders/pointwiseCmulConjShader.js";

/**
 * @param {!WglTexture} stateKet
 * @param {!Controls} controls
 * @param {!WglTexture} controlsTexture
 * @param {!int} rangeOffset
 * @param {!int} rangeLength
 * @returns {!Array.<!WglTexture>}
 */
function amplitudeDisplayStatTextures(
  stateKet,
  controls,
  controlsTexture,
  rangeOffset,
  rangeLength,
) {
  const incoherentKet = probabilityStatTexture(
    stateKet,
    controlsTexture,
    rangeOffset,
    rangeLength,
  );

  const trader = new WglTextureTrader(stateKet);
  trader.dontDeallocCurrentTexture();

  // Put into normal form by throwing away areas not satisfying the controls and cycling the offset away.
  const startingQubits =
    currentShaderCoder().vec2.arrayPowerSizeOfTexture(stateKet);
  const lostQubits = numberOfSetBits(controls.inclusionMask);
  const lostHeadQubits = numberOfSetBits(
    controls.inclusionMask & ((1 << rangeOffset) - 1),
  );
  const involvedQubits = startingQubits - lostQubits;
  const broadcastQubits = involvedQubits - rangeLength;

  // Get relevant case vectors.
  trader.shadeAndTrade(
    (tex) => CircuitShaders.controlSelect(controls, tex),
    WglTexturePool.takeVec2Tex(involvedQubits),
  );
  trader.shadeAndTrade((tex) =>
    GateShaders.cycleAllBits(tex, lostHeadQubits - rangeOffset),
  );
  const ketJustAfterCycle = trader.dontDeallocCurrentTexture();

  // Compute magnitude of each case's vector.
  trader.shadeAndTrade(
    AMPS_TO_SQUARED_MAGS_SHADER,
    WglTexturePool.takeVecFloatTex(involvedQubits),
  );
  for (let k = 0; k < rangeLength; k++) {
    trader.shadeHalveAndTrade(Shaders.sumFoldFloatAdjacents);
  }

  // Find the index of the case with the largest vector.
  trader.shadeAndTrade(
    MAGS_TO_INDEXED_MAGS_SHADER,
    WglTexturePool.takeVec2Tex(broadcastQubits),
  );
  for (let k = 0; k < broadcastQubits; k++) {
    trader.shadeHalveAndTrade(FOLD_MAX_INDEXED_MAG_SHADER);
  }

  // Lookup the components of the largest vector.
  trader.shadeAndTrade(
    (indexed_mag) =>
      LOOKUP_KET_AT_INDEXED_MAG_SHADER(ketJustAfterCycle, indexed_mag),
    WglTexturePool.takeVec2Tex(rangeLength),
  );
  const rawKet = trader.dontDeallocCurrentTexture();

  // Compute the dot product of the largest vector against every other vector.
  trader.shadeAndTrade(
    (small_input) => POINTWISE_CMUL_CONJ_SHADER(small_input, ketJustAfterCycle),
    WglTexturePool.takeVec2Tex(involvedQubits),
  );
  ketJustAfterCycle.deallocByDepositingInPool(
    "ketJustAfterCycle in makeAmplitudeSpanPipeline",
  );
  for (let k = 0; k < rangeLength; k++) {
    trader.shadeHalveAndTrade(Shaders.sumFoldVec2Adjacents);
  }

  // Sum up the magnitudes of the dot products to get a quality metric for how well the largest vector worked.
  trader.shadeAndTrade(
    AMPS_TO_SQUARED_MAGS_SHADER,
    WglTexturePool.takeVecFloatTex(broadcastQubits),
  );
  for (let k = 0; k < broadcastQubits; k++) {
    trader.shadeHalveAndTrade(Shaders.sumFoldFloat);
  }

  if (currentShaderCoder().float.needRearrangingToBeInVec4Format) {
    trader.shadeHalveAndTrade(Shaders.packFloatIntoVec4);
  }
  const denormalizedQuality = trader.currentTexture;

  trader.currentTexture = rawKet;
  if (currentShaderCoder().vec2.needRearrangingToBeInVec4Format) {
    trader.shadeHalveAndTrade(Shaders.packVec2IntoVec4);
  }
  const ket = trader.currentTexture;

  return [ket, denormalizedQuality, incoherentKet];
}

export { amplitudeDisplayStatTextures };
