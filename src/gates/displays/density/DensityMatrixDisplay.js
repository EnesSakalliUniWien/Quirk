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

import { Gate } from "../../../circuit/model/Gate.js";
import { densityDisplayStatTexture } from "./densityDisplayStatTexture.js";
import { densityPixelsToMatrix } from "./densityPixelsToMatrix.js";
import { SINGLE_DENSITY_MATRIX_RENDERER, DENSITY_MATRIX_RENDERER_FROM_CUSTOM_STATS } from "./densityRenderers.js";

/**
 * @param {!GateBuilder} builder
 * @returns {!GateBuilder}
 */
function densityMatrixDisplayMaker_shared(builder) {
    return builder.
        setSymbol("Density").
        setTitle("Density Matrix Display").
        setBlurb("Shows the density matrix of the local mixed state of some wires.\n" +
            "Use controls to see conditional states.").
        promiseHasNoNetEffectOnStateVector().
        setExtraDisableReasonFinder(args => args.isNested ? "can't\nnest\ndisplays\n(sorry)" : undefined);
}

/**
 * @param {!GateBuilder} builder
 * @returns {!GateBuilder}
 */
function singleDensityMatrixDisplayMaker(builder) {
    return densityMatrixDisplayMaker_shared(builder).
        setSerializedId("Density").
        markAsRendererNeedsSingleQubitDensityStats().
        setRenderer(SINGLE_DENSITY_MATRIX_RENDERER);
}

/**
 * @param {!int} span
 * @param {!GateBuilder} builder
 * @returns {!GateBuilder}
 */
function largeDensityMatrixDisplayMaker(span, builder) {
    return densityMatrixDisplayMaker_shared(builder).
        setSerializedId("Density" + span).
        setWidth(span).
        setRenderer(DENSITY_MATRIX_RENDERER_FROM_CUSTOM_STATS).
        setProcessedStatsToJsonFunc(data => {
            return {density_matrix: data.toReadableJson()};
        }).
        setStatTexturesMaker(ctx => densityDisplayStatTexture(
            ctx.stateTrader.currentTexture, ctx.wireCount, ctx.controls, ctx.row, span)).
        setStatPixelDataPostProcessor(densityPixelsToMatrix);
}

const DensityMatrixDisplayFamily = Gate.buildFamily(1, 8, (span, builder) =>
    span === 1 ?
        singleDensityMatrixDisplayMaker(builder) :
        largeDensityMatrixDisplayMaker(span, builder));

export { DensityMatrixDisplayFamily };
