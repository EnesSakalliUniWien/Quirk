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
import { probabilityStatTexture } from "./probabilityStatTexture.js";
import { probabilityPixelsToColumnVector } from "./probabilityPixelsToColumnVector.js";
import { probabilityDataToJson } from "./probabilityDataToJson.js";
import { SINGLE_PROBABILITY_RENDERER, MULTI_PROBABILITY_RENDERER } from "./probabilityRenderers.js";

/**
 * @param {!GateBuilder} builder
 * @returns {!GateBuilder}
 */
function shared_chanceGateMaker(builder) {
  return builder
    .setSymbol("Chance")
    .setTitle("Probability Display")
    .setBlurb(
      "Shows chances of outcomes if a measurement was performed.\n" +
        "Use controls to see conditional probabilities.",
    )
    .promiseHasNoNetEffectOnStateVector()
    .setExtraDisableReasonFinder((args) =>
      args.isNested ? "can't\nnest\ndisplays\n(sorry)" : undefined,
    );
}

/**
 * @param {!GateBuilder} builder
 * @param {!int} span
 * @returns {!GateBuilder}
 */
function multiChanceGateMaker(span, builder) {
  return shared_chanceGateMaker(builder)
    .setSerializedId("Chance" + span)
    .setStatTexturesMaker((ctx) =>
      probabilityStatTexture(
        ctx.stateTrader.currentTexture,
        ctx.controlsTexture,
        ctx.row,
        span,
      ),
    )
    .setStatPixelDataPostProcessor((pixels) =>
      probabilityPixelsToColumnVector(pixels, span),
    )
    .setProcessedStatsToJsonFunc(probabilityDataToJson)
    .setRenderer(MULTI_PROBABILITY_RENDERER);
}

/**
 * @param {!GateBuilder} builder
 * @returns {!GateBuilder}
 */
function singleChangeGateMaker(builder) {
  return shared_chanceGateMaker(builder)
    .setSerializedId("Chance")
    .markAsRendererNeedsSingleQubitDensityStats()
    .setRenderer(
      SINGLE_PROBABILITY_RENDERER,
    );
}

const ProbabilityDisplayFamily = Gate.buildFamily(1, 16, (span, builder) =>
  span === 1
    ? singleChangeGateMaker(builder)
    : multiChanceGateMaker(span, builder),
);

export { ProbabilityDisplayFamily };
