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

import { GateShaders } from "../../../engine/simulation/gpu/GateShaders.js";
import { Shaders } from "../../../engine/webgl/operations/Shaders.js";
import { currentShaderCoder } from "../../../engine/webgl/coder/ShaderCoders.js";
import { WglTexturePool } from "../../../engine/webgl/texture/WglTexturePool.js";
import { WglTextureTrader } from "../../../engine/webgl/texture/WglTextureTrader.js";
import { amplitudesToProbabilities } from "./shaders/amplitudesToProbabilities.js";

/**
 * Derives conditional computational basis measurement probabilities from the state vector.
 *
 * @param {!WglTexture} ketTexture The texture storing the wavefunction.
 * @param {!WglTexture} controlTexture A precomputed texture storing a control mask set to 1 for satisfying states.
 * @param {!int} rangeOffset Which wire the probability display starts on.
 * @param {!int} rangeLength How many wires the probability display covers.
 * @returns {!WglTexture} Texture storing the probabilities. Not normalized.
 */
function probabilityStatTexture(
  ketTexture,
  controlTexture,
  rangeOffset,
  rangeLength,
) {
  const trader = new WglTextureTrader(ketTexture);
  trader.dontDeallocCurrentTexture();
  let n = currentShaderCoder().vec2.arrayPowerSizeOfTexture(ketTexture);

  trader.shadeAndTrade(
    (tex) => amplitudesToProbabilities(tex, controlTexture),
    WglTexturePool.takeVecFloatTex(n),
  );
  trader.shadeAndTrade((tex) =>
    GateShaders.cycleAllBitsFloat(tex, -rangeOffset),
  );

  while (n > rangeLength) {
    n -= 1;
    trader.shadeHalveAndTrade(Shaders.sumFoldFloat);
  }

  if (currentShaderCoder().float.needRearrangingToBeInVec4Format) {
    trader.shadeQuarterAndTrade(Shaders.packFloatIntoVec4);
  }
  return trader.currentTexture;
}

export { probabilityStatTexture };
