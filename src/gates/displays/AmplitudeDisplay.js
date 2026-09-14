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

import { AMPLITUDE_RENDERER_FROM_CUSTOM_STATS } from "../../draw/displays/AmplitudeView.js";

import { CircuitShaders } from "../../engine/simulation/gpu/CircuitShaders.js";
import { Gate } from "../../circuit/model/Gate.js";

import { GateShaders } from "../../engine/simulation/gpu/GateShaders.js";

import {Matrix} from "../../engine/math/matrix/Matrix.js";
import { probabilityStatTexture } from "./ProbabilityDisplay.js";

import { Util } from "../../base/Util.js";
import { Shaders } from "../../engine/webgl/shader/Shaders.js";

import {
  Inputs,
  Outputs,
  currentShaderCoder,
  makePseudoShaderWithInputsAndOutputAndCode,
} from "../../engine/webgl/coder/ShaderCoders.js";
import { WglTexturePool } from "../../engine/webgl/texture/WglTexturePool.js";
import { WglTextureTrader } from "../../engine/webgl/texture/WglTextureTrader.js";
import { ReadableJson } from "../../engine/math/matrix/ReadableJson.js";

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
  const lostQubits = Util.numberOfSetBits(controls.inclusionMask);
  const lostHeadQubits = Util.numberOfSetBits(
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

/**
 * @param {!int} span
 * @param {!Array.<!Float32Array>} pixelGroups
 * @param {!CircuitDefinition} circuitDefinition
 * @returns {!{quality: !number, ket: !Matrix, phaseLockIndex: !int,incoherentKet: !Matrix}}
 */
function processOutputs(span, pixelGroups, circuitDefinition) {
  const [ketPixels, qualityPixels, rawIncoherentKetPixels] = pixelGroups;
  const denormalizedQuality = qualityPixels[0];
  const n = 1 << span;
  const w = n === 2 ? 2 : 1 << Math.floor(Math.round(Math.log2(n)) / 2);
  const h = n / w;

  // Rescale quantities.
  let unity = 0;
  for (const e of ketPixels) {
    unity += e * e;
  }
  const incoherentKetPixels = new Float32Array(w * h * 2);
  let incoherentUnity = 0;
  for (let i = 0; i < n; i++) {
    incoherentUnity += rawIncoherentKetPixels[i];
  }
  for (let i = 0; i < n; i++) {
    incoherentKetPixels[i << 1] = Math.sqrt(
      rawIncoherentKetPixels[i] / incoherentUnity,
    );
  }
  if (Number.isNaN(incoherentUnity) || incoherentUnity < 0.000001) {
    return {
      quality: 0.0,
      ket: Matrix.zero(w, h).times(NaN),
      phaseLockIndex: 0,
      incoherentKet: Matrix.zero(w, h).times(NaN),
    };
  }
  const quality = denormalizedQuality / unity / incoherentUnity;

  const phaseIndex =
    span === circuitDefinition.numWires
      ? undefined
      : _processOutputs_pickPhaseLockIndex(ketPixels);
  const phase =
    phaseIndex === undefined
      ? 0
      : Math.atan2(ketPixels[phaseIndex * 2 + 1], ketPixels[phaseIndex * 2]);
  const c = Math.cos(phase);
  const s = -Math.sin(phase);

  const buf = new Float32Array(n * 2);
  const sqrtUnity = Math.sqrt(unity);
  for (let i = 0; i < n; i++) {
    const real = ketPixels[i * 2] / sqrtUnity;
    const imag = ketPixels[i * 2 + 1] / sqrtUnity;
    buf[i * 2] = real * c + imag * -s;
    buf[i * 2 + 1] = real * s + imag * c;
  }
  return {
    quality,
    ket: new Matrix(w, h, buf),
    phaseLockIndex: phaseIndex,
    incoherentKet: new Matrix(w, h, incoherentKetPixels),
  };
}

/**
 * @param {!Float32Array} ketPixels
 * @returns {!int}
 * @private
 */
function _processOutputs_pickPhaseLockIndex(ketPixels) {
  let result = 0;
  let best = 0;
  for (let k = 0; k < ketPixels.length; k += 2) {
    const r = ketPixels[k];
    const i = ketPixels[k + 1];
    const m = r * r + i * i;
    if (m > best * 10000) {
      best = m;
      result = k >> 1;
    }
  }
  return result;
}

const AMPS_TO_SQUARED_MAGS_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.vec2("input")],
  Outputs.float(),
  `float outputFor(float k) {
        vec2 ri = read_input(k);
        return dot(ri, ri);
    }`,
);

const MAGS_TO_INDEXED_MAGS_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.float("input")],
  Outputs.vec2(),
  `vec2 outputFor(float k) {
        return vec2(float(k), read_input(k));
    }`,
);

const FOLD_MAX_INDEXED_MAG_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.vec2("input")],
  Outputs.vec2(),
  `vec2 outputFor(float k) {
        vec2 a = read_input(k);
        vec2 b = read_input(k + len_output());
        return a.y >= b.y ? a : b;
    }`,
);

const LOOKUP_KET_AT_INDEXED_MAG_SHADER =
  makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2("input"), Inputs.vec2("indexed_mag")],
    Outputs.vec2(),
    `vec2 outputFor(float k) {
        return read_input(k + read_indexed_mag(0.0).x * len_output());
    }`,
  );

const POINTWISE_CMUL_CONJ_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.vec2("small_input"), Inputs.vec2("large_input")],
  Outputs.vec2(),
  `
    vec2 cmul_conj(vec2 c1, vec2 c2) {
        return mat2(c1.x, -c1.y, c1.y, c1.x) * c2;
    }
    vec2 outputFor(float k) {
        vec2 in1 = read_small_input(floor(mod(k + 0.5, len_small_input())));
        vec2 in2 = read_large_input(k);
        return cmul_conj(in1, in2);
    }
    `,
);

/**
 * @param {!{quality: !number, ket: !Matrix, phaseLockIndex: !int,incoherentKet: !Matrix}} customStats
 */
function customStatsToJsonData(customStats) {
  const { quality, ket, phaseLockIndex, incoherentKet } = customStats;
  const n = ket.width() * ket.height();
  return {
    coherence_measure: quality,
    superposition_phase_locked_state_index:
      phaseLockIndex === undefined ? null : phaseLockIndex,
    ket: ReadableJson.complexVector(
      new Matrix(1, n, ket.rawBuffer()).getColumn(0),
    ),
    incoherentKet: ReadableJson.realVector(
      new Matrix(1, n, incoherentKet.rawBuffer()).getColumn(0),
    ),
  };
}

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

export {
  AmplitudeDisplayFamily,
  AMPS_TO_SQUARED_MAGS_SHADER,
  MAGS_TO_INDEXED_MAGS_SHADER,
  FOLD_MAX_INDEXED_MAG_SHADER,
  LOOKUP_KET_AT_INDEXED_MAG_SHADER,
  POINTWISE_CMUL_CONJ_SHADER,
  amplitudeDisplayStatTextures,
};
