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

import { paintMultiProbabilityDisplay } from "../../draw/pixi/displays/ProbabilityView.js";

import { Complex } from "../../engine/math/complex/Complex.js";

import { Gate } from "../../circuit/model/Gate.js";
import { GatePainting } from "../../draw/gate/GatePainting.js";
import { GateShaders } from "../../engine/simulation/gpu/GateShaders.js";
import { MathPainter } from "../../draw/MathPainter.js";
import { Matrix } from "../../engine/math/matrix/Matrix.js";

import { Shaders } from "../../engine/webgl/shader/Shaders.js";

/** @typedef {import("../../engine/webgl/shader/WglConfiguredShader.js").WglConfiguredShader} WglConfiguredShader */
import {
  Inputs,
  Outputs,
  currentShaderCoder,
  makePseudoShaderWithInputsAndOutputAndCode,
} from "../../engine/webgl/coder/ShaderCoders.js";
import { WglTexturePool } from "../../engine/webgl/texture/WglTexturePool.js";
import { WglTextureTrader } from "../../engine/webgl/texture/WglTextureTrader.js";

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

/**
 * @param {!WglTexture} inputTexture
 * @param {!WglTexture} controlTex
 * @returns {!WglConfiguredShader}
 */
const amplitudesToProbabilities = (inputTexture, controlTex) =>
  AMPLITUDES_TO_PROBABILITIES_SHADER(inputTexture, controlTex);
const AMPLITUDES_TO_PROBABILITIES_SHADER =
  makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2("input"), Inputs.bool("control")],
    Outputs.float(),
    `float outputFor(float k) {
        vec2 amp = read_input(k);
        return dot(amp, amp) * read_control(k);
    }`,
  );

/**
 * Post-processes the pixels that come out of makeProbabilitySpanPipeline into a vector of normalized probabilities.
 * @param {!Float32Array} pixels
 * @param {!int} span
 * @returns {!Matrix}
 */
function probabilityPixelsToColumnVector(pixels, span) {
  const n = 1 << span;
  // CAUTION: pixels may be longer than n due to the length rounding up to a multiple of 4.

  let unity = 0;
  for (let i = 0; i < n; i++) {
    unity += pixels[i];
  }
  if (Number.isNaN(unity) || unity < 0.000001) {
    return Matrix.zero(1, n).times(NaN);
  }
  const buf = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    buf[i * 2] = pixels[i] / unity;
  }
  return new Matrix(1, n, buf);
}

/**
 * Produces the exported simulator data associated with a probability display.
 * @param {!Matrix} data
 * @returns {!{probabilities: !float[]}}
 */
function probabilityDataToJson(data) {
  return {
    probabilities: Array.from({ length: data.height() }, (_, k) =>
      Complex.realPartOf(data.cell(0, k)),
    ),
  };
}

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
    .setDrawer(GatePainting.makeDisplayDrawer(paintMultiProbabilityDisplay));
}

/**
 * @param {!GateBuilder} builder
 * @returns {!GateBuilder}
 */
function singleChangeGateMaker(builder) {
  return shared_chanceGateMaker(builder)
    .setSerializedId("Chance")
    .markAsDrawerNeedsSingleQubitDensityStats()
    .setDrawer(
      GatePainting.makeDisplayDrawer((args) => {
        const { row, col } = args.positionInCircuit;
        MathPainter.paintProbabilityBox(
          args.painter,
          args.stats.controlledWireProbabilityJustAfter(row, col),
          args.rect,
          args.focusPoints,
        );
      }),
    );
}

const ProbabilityDisplayFamily = Gate.buildFamily(1, 16, (span, builder) =>
  span === 1
    ? singleChangeGateMaker(builder)
    : multiChanceGateMaker(span, builder),
);

export {
  ProbabilityDisplayFamily,
  probabilityStatTexture,
  probabilityPixelsToColumnVector,
  amplitudesToProbabilities,
  probabilityDataToJson,
};
