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
import { numberOfSetBits } from "../../../engine/math/bitOperations.js";
import { Shaders } from "../../../engine/webgl/operations/Shaders.js";
import { currentShaderCoder } from "../../../engine/webgl/coder/ShaderCoders.js";
import { WglTexturePool } from "../../../engine/webgl/texture/WglTexturePool.js";
import { WglTextureTrader } from "../../../engine/webgl/texture/WglTextureTrader.js";
import { amplitudesToCouplings } from "./shaders/amplitudesToCouplings.js";

/**
 * @param {!WglTexture} inp
 * @param {!Controls} controls
 * @param {!int} qubitCount
 * @param {!int} rangeOffset
 * @param {!int} rangeLength
 * @returns {!WglTexture}
 */
function densityDisplayStatTexture(inp, qubitCount, controls, rangeOffset, rangeLength) {
    const trader = new WglTextureTrader(inp);
    trader.dontDeallocCurrentTexture();

    // Put into normal form by throwing away areas not satisfying the controls and cycling the offset away.
    const startingQubits = currentShaderCoder().vec2.arrayPowerSizeOfTexture(inp);
    const lostQubits = numberOfSetBits(controls.inclusionMask);
    const lostHeadQubits = numberOfSetBits(controls.inclusionMask & ((1<<rangeOffset)-1));
    trader.shadeAndTrade(
            ket => CircuitShaders.controlSelect(controls, ket),
        WglTexturePool.takeVec2Tex(startingQubits - lostQubits));
    trader.shadeAndTrade(ket => GateShaders.cycleAllBits(ket, lostHeadQubits-rangeOffset));

    // Expand amplitudes into couplings.
    let n = qubitCount - lostQubits + rangeLength;
    trader.shadeAndTrade(e => amplitudesToCouplings(e, rangeLength), WglTexturePool.takeVec2Tex(n));

    // Sum up the density matrices from all combinations of the unincluded qubits' values.
    while (n > 2*rangeLength) {
        n--;
        trader.shadeHalveAndTrade(Shaders.sumFoldVec2);
    }

    if (currentShaderCoder().vec2.needRearrangingToBeInVec4Format) {
        trader.shadeHalveAndTrade(Shaders.packVec2IntoVec4);
    }
    return trader.currentTexture;
}

export { densityDisplayStatTexture };
