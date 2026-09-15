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

import { DetailedError } from "../../../base/DetailedError.js";
import { isPowerOf2 } from "../../math/powersOfTwo.js";
import { properMod } from "../../math/modularArithmetic.js";
import { Shaders } from "../../webgl/operations/Shaders.js";
import { WglArg } from "../../webgl/shader/WglArg.js";
import { currentShaderCoder } from "../../webgl/coder/ShaderCoders.js";
import { ketArgs } from "./KetShaderUtil.js";

import { CUSTOM_SINGLE_QUBIT_OPERATION_SHADER } from "./gateShaders/customSingleQubitOperationShader.js";
import { matrix_operation_shaders } from "./gateShaders/matrixOperationShaders.js";
import { CYCLE_ALL_SHADER_VEC2 } from "./gateShaders/cycleAllShaderVec2.js";
import { CYCLE_ALL_SHADER_FLOAT } from "./gateShaders/cycleAllShaderFloat.js";

/** @typedef {import("../../math/matrix/Matrix.js").Matrix} Matrix */
/** @typedef {import("../CircuitEvalContext.js").CircuitEvalContext} CircuitEvalContext */
/** @typedef {import("../../webgl/shader/WglConfiguredShader.js").WglConfiguredShader} WglConfiguredShader */
/** @typedef {import("../../webgl/texture/WglTexture.js").WglTexture} WglTexture */

/**
 * Applies gate matrices to a superposition and configures bit-cycling shaders for displays.
 *
 * Operations receive their state through CircuitEvalContext or an input texture; the class has
 * no per-instance state. Imported shader definitions are created once and reused across calls.
 */
class GateShaders {
    /**
     * Applies a matrix to the qubits selected by ctx, respecting its controls.
     * Single-qubit coefficients use vec2 uniforms; two- and three-qubit matrices use vec4
     * uniforms; four-qubit matrices use a temporary texture released after the operation.
     *
     * @param {!CircuitEvalContext} ctx
     * @param {!Matrix} matrix
     * @returns {void}
     */
    static applyMatrixOperation(ctx, matrix) {
        if (!isPowerOf2(matrix.width())) {
            throw new DetailedError("Matrix size isn't a power of 2.", {ctx, matrix});
        }

        if (matrix.width() === 2) {
            GateShaders._applySingleQubitOperationFunc(ctx, matrix);
            return;
        }
        const sizePower = Math.round(Math.log2(matrix.width()));

        if (sizePower <= 3) {
            ctx.applyOperation(matrix_operation_shaders[sizePower].withArgs(
                ...ketArgs(ctx),
                WglArg.vec4_array("coefs", matrix.rawBuffer())));
            return;
        }

        if (sizePower <= 4) {
            const tex = Shaders.data(currentShaderCoder().vec2.dataToPixels(matrix.rawBuffer())).toVec2Texture(sizePower * 2);
            try {
                ctx.applyOperation(matrix_operation_shaders[sizePower].withArgs(
                    tex,
                    ...ketArgs(ctx)));
            } finally {
                tex.deallocByDepositingInPool();
            }
            return;
        }

        throw new DetailedError("Matrix is past 4 qubits. Too expensive.", {ctx, matrix});
    }

    /**
     * Configures bit cycling for a texture of complex amplitudes.
     * @param {!WglTexture} inputTexture
     * @param {!int} shiftAmount
     * @returns {!WglConfiguredShader}
     */
    static cycleAllBits(inputTexture, shiftAmount) {
        const size = currentShaderCoder().vec2.arrayPowerSizeOfTexture(inputTexture);
        return CYCLE_ALL_SHADER_VEC2(
            inputTexture,
            WglArg.float("shiftAmount", 1 << properMod(-shiftAmount, size)));
    }

    /**
     * Configures bit cycling for a texture of scalar values, such as probabilities.
     * @param {!WglTexture} inputTexture
     * @param {!int} shiftAmount
     * @returns {!WglConfiguredShader}
     */
    static cycleAllBitsFloat(inputTexture, shiftAmount) {
        const size = currentShaderCoder().float.arrayPowerSizeOfTexture(inputTexture);
        return CYCLE_ALL_SHADER_FLOAT(
            inputTexture,
            WglArg.float("shiftAmount", 1 << properMod(-shiftAmount, size)));
    }

    /**
     * Renders the result of applying a custom controlled single-qubit operation.
     * @param {!CircuitEvalContext} ctx
     * @param {!Matrix} matrix
     * @returns {void}
     * @private
     */
    static _applySingleQubitOperationFunc(ctx, matrix) {
        if (matrix.width() !== 2 || matrix.height() !== 2) {
            throw new DetailedError("Not a single-qubit operation.", {matrix});
        }
        const [ar, ai, br, bi, cr, ci, dr, di] = matrix.rawBuffer();
        ctx.applyOperation(CUSTOM_SINGLE_QUBIT_OPERATION_SHADER.withArgs(
            ...ketArgs(ctx),
            WglArg.vec2("a", ar, ai),
            WglArg.vec2("b", br, bi),
            WglArg.vec2("c", cr, ci),
            WglArg.vec2("d", dr, di)));
    }
}

export { GateShaders };
