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

import { Controls } from "../../../circuit/model/Controls.js";
import { ketArgs } from "./KetShaderUtil.js";
import { Shaders } from "../../webgl/operations/Shaders.js";
import { ceilingPowerOf2 } from "../../math/powersOfTwo.js";
import { numberOfSetBits } from "../../math/bitOperations.js";
import { WglArg } from "../../webgl/shader/WglArg.js";
import { currentShaderCoder } from "../../webgl/coder/ShaderCoders.js";

import { SET_SINGLE_PIXEL_SHADER } from "./circuitShaders/setSinglePixelShader.js";
import { LINEAR_OVERLAY_SHADER } from "../../webgl/operations/shaders/linearOverlayShader.js";
import { CONTROL_MASK_SHADER } from "./circuitShaders/controlMaskShader.js";
import { CONTROL_SELECT_SHADER } from "./circuitShaders/controlSelectShader.js";
import { SWAP_QUBITS_SHADER } from "./circuitShaders/swapQubitsShader.js";
import { QUBIT_DENSITIES_SHADER } from "./circuitShaders/qubitDensitiesShader.js";

/** @typedef {import("../CircuitEvalContext.js").CircuitEvalContext} CircuitEvalContext */
/** @typedef {import("../../webgl/shader/WglConfiguredShader.js").WglConfiguredShader} WglConfiguredShader */
/** @typedef {import("../../webgl/texture/WglTexture.js").WglTexture} WglTexture */

/**
 * Configures shaders to initialize, advance, and inspect quantum states stored in WebGL textures.
 *
 * Each static method returns a configured shader for the caller to render. The class has no
 * per-instance state. Imported shader definitions are created once and reused across calls.
 */
class CircuitShaders {
    /**
     * Returns a configured shader that renders the superposition corresponding to a classical state.
     *
     * @param {!int} stateBitMask
     * @returns {!WglConfiguredShader}
     */
    static classicalState(stateBitMask) {
        return SET_SINGLE_PIXEL_SHADER(WglArg.float("state", stateBitMask));
    }

    /**
     * Renders a texture with the given background texture, but with the given foreground texture's data scanned
     * linearly into the background.
     *
     * @param {!int} offset
     * @param {!WglTexture} foregroundTexture
     * @param {!WglTexture} backgroundTexture
     * @returns {!WglConfiguredShader}
     */
    static linearOverlay(offset, foregroundTexture, backgroundTexture) {
        return LINEAR_OVERLAY_SHADER(
            backgroundTexture,
            foregroundTexture,
            WglArg.float("offset", offset));
    }

    /**
     * Returns a configured shader that renders a control mask texture corresponding to the given control mask, with 1s
     * at pixels meeting the control and 0s at pixels not meeting the control.
     * @param {!Controls} controlMask
     * @returns {!WglConfiguredShader}
     */
    static controlMask(controlMask) {
        if (controlMask.isEqualTo(Controls.NONE)) {
            return Shaders.color(1, 0, 0, 0);
        }

        return CONTROL_MASK_SHADER(
            WglArg.float('used', controlMask.inclusionMask),
            WglArg.float('desired', controlMask.desiredValueMask));
    }

    /**
     * Returns a configured shader that renders only the control-matching parts of an input texture to a smaller output
     * texture. This allows later shaders to omit any control-masking steps (and to work on less data).
     * @param {!Controls} controlMask
     * @param {!WglTexture} dataTexture
     * @returns {!WglConfiguredShader}
     */
    static controlSelect(controlMask, dataTexture) {
        if (controlMask.isEqualTo(Controls.NONE)) {
            return Shaders.passthrough(dataTexture);
        }

        return CONTROL_SELECT_SHADER(
            dataTexture,
            WglArg.float('used', controlMask.inclusionMask),
            WglArg.float('desired', controlMask.desiredValueMask));
    }

    /**
     * Renders the result of applying a controlled swap operation to a superposition.
     *
     * @param {!CircuitEvalContext} ctx
     * @param {!int} otherRow
     * @returns {!WglConfiguredShader}
     */
    static swap(ctx, otherRow) {
        return SWAP_QUBITS_SHADER.withArgs(...ketArgs(ctx, otherRow - ctx.row + 1));
    }

    /**
     * Returns a configured shader that renders the marginal states of each qubit, for each possible value of the other
     * qubits (i.e. folding still needs to be done), into a destination texture. The marginal states are laid out in
     * [a,br,bi,d] order within each pixel and represent the density matrix {{a, b},{b*, d}}.
     * @param {!WglTexture} inputTexture A superposition texture.
     * @param {undefined|!int=} keptBitMask A bit mask with a 1 at the positions corresponding to indices of the desired
     * qubit densities.
     * @returns {!WglConfiguredShader}
     */
    static qubitDensities(inputTexture, keptBitMask = undefined) {
        if (keptBitMask === undefined) {
            keptBitMask = (1 << currentShaderCoder().vec2.arrayPowerSizeOfTexture(inputTexture)) - 1;
        }
        const keptCount = ceilingPowerOf2(numberOfSetBits(keptBitMask));

        return QUBIT_DENSITIES_SHADER(
            inputTexture,
            WglArg.float('keptCount', keptCount),
            WglArg.float('keptBitMask', keptBitMask));
    }
}

export { CircuitShaders };
