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

import { paintSampleDisplay } from "../../draw/pixi/displays/SampleView.js";

import { Gate } from "../../circuit/model/Gate.js";
import { GatePainting } from "../../draw/gate/GatePainting.js";

import {
  probabilityStatTexture,
  probabilityPixelsToColumnVector,
  probabilityDataToJson,
} from "./ProbabilityDisplay.js";

let SampleDisplayFamily = Gate.buildFamily(1, 16, (span, builder) =>
  builder
    .setSerializedId("Sample" + span)
    .setSymbol("Sample")
    .setTitle("Sampled Results Display")
    .setBlurb(
      "Shows a random sample of possible measurement outcomes.\nUse controls to see conditional samples.",
    )
    .setStatTexturesMaker((ctx) =>
      probabilityStatTexture(
        ctx.stateTrader.currentTexture,
        ctx.controlsTexture,
        ctx.row,
        span,
      ),
    )
    .setStatPixelDataPostProcessor((e) =>
      probabilityPixelsToColumnVector(e, span),
    )
    .promiseHasNoNetEffectOnStateVectorButStillRequiresDynamicRedraw()
    .setProcessedStatsToJsonFunc(probabilityDataToJson)
    .setDrawer(GatePainting.makeDisplayDrawer(paintSampleDisplay))
    .setExtraDisableReasonFinder((args) =>
      args.isNested ? "can't\nnest\ndisplays\n(sorry)" : undefined,
    ),
);

export { SampleDisplayFamily };
