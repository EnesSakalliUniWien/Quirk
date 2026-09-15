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

import { AMPLITUDE_RENDERER_FROM_CUSTOM_STATS } from "../../../draw/displays/amplitudes/AmplitudeView.js";
import { Gate } from "../../../circuit/model/Gate.js";
import { amplitudeDisplayStatTextures } from "./amplitudeDisplayStatTextures.js";
import { processOutputs } from "./processOutputs.js";
import { customStatsToJsonData } from "./customStatsToJsonData.js";

const AmplitudeDisplayFamily = Gate.buildFamily(1, 16, (span, builder) =>
  builder
    .setSerializedId("Amps" + span)
    .setSymbol("Amps")
    .setTitle("Amplitude Display")
    .setBlurb(
      "Shows state-vector amplitudes reshaped as a grid, if separable.\nUse controls to see conditional amplitudes.",
    )
    .setWidth(span === 1 ? 2 : span % 2 === 0 ? span : Math.ceil(span / 2))
    .promiseHasNoNetEffectOnStateVector()
    .setExtraDisableReasonFinder((args) =>
      args.isNested ? "can't\nnest\ndisplays\n(sorry)" : undefined,
    )
    .setStatTexturesMaker((ctx) =>
      amplitudeDisplayStatTextures(
        ctx.stateTrader.currentTexture,
        ctx.controls,
        ctx.controlsTexture,
        ctx.row,
        span,
      ),
    )
    .setStatPixelDataPostProcessor((val, def) => processOutputs(span, val, def))
    .setProcessedStatsToJsonFunc(customStatsToJsonData)
    .setRenderer(AMPLITUDE_RENDERER_FROM_CUSTOM_STATS),
);

export { AmplitudeDisplayFamily };
