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

import { CircuitShaders } from "./CircuitShaders.js";
import { Controls } from "../../../circuit/model/Controls.js";
import { DetailedError } from "../../../base/DetailedError.js";
import { Matrix } from "../../math/matrix/Matrix.js";
import { Shaders } from "../../webgl/operations/Shaders.js";
import { ceilingPowerOf2, ceilLg2 } from "../../math/powersOfTwo.js";
import { numberOfSetBits } from "../../math/bitOperations.js";
import { WglTexture } from "../../webgl/texture/WglTexture.js";
import {
  currentShaderCoder,
  makePseudoShaderWithInputsAndOutputAndCode,
  Inputs,
  Outputs,
} from "../../webgl/coder/ShaderCoders.js";
import { WglTexturePool } from "../../webgl/texture/WglTexturePool.js";
import { WglTextureTrader } from "../../webgl/texture/WglTextureTrader.js";

/**
 * Utilities related to storing and operation on superpositions and other circuit information in WebGL textures.
 */
class KetTextureUtil {}

/**
 * @param {!WglTextureTrader} trader
 * @returns {!Float32Array}
 */
KetTextureUtil.tradeTextureForVec2Output = (trader) => {
  if (currentShaderCoder().vec2.needRearrangingToBeInVec4Format) {
    trader.shadeHalveAndTrade(Shaders.packVec2IntoVec4);
  }
  return KetTextureUtil.tradeTextureForVec4Output(trader);
};

/**
 * @param {!WglTextureTrader} trader
 * @returns {!Float32Array}
 */
KetTextureUtil.tradeTextureForVec4Output = (trader) => {
  const result = currentShaderCoder().vec4.pixelsToData(
    trader.currentTexture.readPixels(),
  );
  trader.currentTexture.deallocByDepositingInPool("tradeTextureForVec4Output");
  return result;
};

/**
 * Overlays textures end to end in one, so they can be read in a single go.
 *
 * @param {!Array.<!WglTexture>} textures
 * @returns {!{merged: !WglTexture, used: !int, lengths: !Array.<!int>}} The merged texture, which is a
 *     power of two in size; how many of its pixels hold the textures' data; and how many pixels each
 *     of the textures takes, in order. The textures themselves are left to the caller.
 */
function overlaidForReadback(textures) {
  const lengths = textures.map((tex) =>
    tex.width === 0
      ? 0
      : 1 << currentShaderCoder().vec4.arrayPowerSizeOfTexture(tex),
  );
  const used = lengths.reduce((total, length) => total + length, 0);
  const totalPowerSize = Math.round(Math.log2(ceilingPowerOf2(used)));

  const trader = new WglTextureTrader(
    Shaders.color(0, 0, 0, 0).toVec4Texture(totalPowerSize),
  );
  let offset = 0;
  textures.forEach((tex, i) => {
    if (tex.width > 0) {
      trader.shadeAndTrade((acc) =>
        CircuitShaders.linearOverlay(offset, tex, acc),
      );
    }
    offset += lengths[i];
  });
  return { merged: trader.currentTexture, used, lengths };
}

/**
 * Cuts the merged pixels back into the arrays of the textures that were overlaid.
 *
 * @param {!Array.<!int>} lengths
 * @param {!Float32Array} combinedPixels
 * @returns {!Array.<!Float32Array>}
 */
function splitReadback(lengths, combinedPixels) {
  let pixelOffset = 0;
  return lengths.map((length) => {
    const pixelLen = length << 2;
    const result = combinedPixels.subarray(pixelOffset, pixelOffset + pixelLen);
    pixelOffset += pixelLen;
    return result;
  });
}

/**
 * @param {!Array.<!WglTexture>} textures The textures to read and deallocate as a group.
 * @returns {!Array.<!Float32Array>}
 */
KetTextureUtil.mergedReadFloats = (textures) => {
  // The merged texture is a power of two in size; only the rows holding the data are read.
  const { merged, used, lengths } = overlaidForReadback(textures);
  const combinedPixels = currentShaderCoder().vec4.pixelsToData(
    merged.readPixels(false, used),
  );
  merged.deallocByDepositingInPool("mergedReadFloats");

  for (const tex of textures) {
    tex.deallocByDepositingInPool();
  }
  return splitReadback(lengths, combinedPixels);
};

/**
 * A mergedReadFloats that has been started and not yet finished, because it did not wait for the GPU.
 */
class PendingMergedRead {
  /**
   * @param {!WglPixelReadback} readback
   * @param {!Array.<!int>} lengths
   */
  constructor(readback, lengths) {
    /** @private */
    this._readback = readback;
    /** @private */
    this._lengths = lengths;
  }

  /**
   * @returns {undefined|!Array.<!Float32Array>} What mergedReadFloats would have returned, once the
   *     GPU has got that far; undefined until then.
   * @throws {!DetailedError} If the context was lost meanwhile.
   */
  poll() {
    const pixels = this._readback.poll();
    return pixels === undefined
      ? undefined
      : splitReadback(
          this._lengths,
          currentShaderCoder().vec4.pixelsToData(pixels),
        );
  }

  /** Gives up on the read, freeing what it holds. */
  cancel() {
    this._readback.cancel();
  }
}

/**
 * Starts mergedReadFloats without waiting for the GPU, and returns before the data is there.
 *
 * Every texture has gone back to the pool when this returns: the read was queued behind the work
 * that drew them, and the GPU runs commands in the order it was given them, so whatever draws into
 * those textures next draws after the read.
 *
 * @param {!Array.<!WglTexture>} textures The textures to read and deallocate as a group.
 * @returns {!PendingMergedRead}
 */
KetTextureUtil.startMergedReadFloats = (textures) => {
  const { merged, used, lengths } = overlaidForReadback(textures);
  let readback;
  try {
    readback = merged.startReadPixels(used);
  } finally {
    merged.deallocByDepositingInPool("startMergedReadFloats");
    for (const tex of textures) {
      tex.deallocByDepositingInPool();
    }
  }
  return new PendingMergedRead(readback, lengths);
};

/**
 * @param {!Float32Array} pixels
 * @param {!number} unity
 * @param {!int=} size How many amplitudes the state has, when more than the pixels hold. The rest are
 *     zero, as for wires that nothing touched, and are made here so that no second copy is needed to
 *     pad the state out.
 * @returns {!Matrix}
 */
KetTextureUtil.pixelsToAmplitudes = (
  pixels,
  unity,
  size = pixels.length >> 1,
) => {
  // Renormalization factor. For better answers when non-unitary gates are used.
  if (unity < 0.000001) {
    unity = NaN;
  }

  const d = Math.sqrt(unity);
  const buf = new Float32Array(size * 2);
  const end = Math.min(pixels.length, buf.length);
  for (let i = 0; i < end; i++) {
    buf[i] = pixels[i] / d;
  }
  return new Matrix(1, size, buf);
};

/**
 * @param {!WglTexture} stateTex
 * @param {!Controls} controls
 * @param {!int} keptBitMask
 * @returns {!WglTexture}
 */
KetTextureUtil.superpositionToQubitDensities = (
  stateTex,
  controls,
  keptBitMask,
) => {
  if (keptBitMask === 0) {
    return new WglTexture(0, 0, currentShaderCoder().vec4.pixelType);
  }
  const hasControls = !controls.isEqualTo(Controls.NONE);
  const trader = new WglTextureTrader(stateTex);
  trader.dontDeallocCurrentTexture();
  if (hasControls) {
    const n =
      currentShaderCoder().vec2.arrayPowerSizeOfTexture(stateTex) -
      controls.includedBitCount();
    trader.shadeAndTrade(
      (t) => CircuitShaders.controlSelect(controls, t),
      WglTexturePool.takeVec2Tex(n),
    );
  }

  let p = 1;
  for (let i = 1; i <= controls.inclusionMask; i <<= 1) {
    if ((controls.inclusionMask & i) === 0) {
      p <<= 1;
    } else {
      keptBitMask = (keptBitMask & (p - 1)) | ((keptBitMask & ~(p - 1)) >> 1);
    }
  }

  _superpositionTexToUnsummedQubitDensitiesTex(trader, keptBitMask);
  const keptQubitCount = numberOfSetBits(keptBitMask);
  _sumDownVec4(trader, keptQubitCount);

  return trader.currentTexture;
};

/**
 * @param {!WglTextureTrader} trader
 * @param {!int} keptBitMask
 */
function _superpositionTexToUnsummedQubitDensitiesTex(trader, keptBitMask) {
  if (keptBitMask === 0) {
    throw new DetailedError("keptBitMask === 0", { trader, keptBitMask });
  }
  const startingQubitCount = currentShaderCoder().vec2.arrayPowerSizeOfTexture(
    trader.currentTexture,
  );
  const remainingQubitCount = numberOfSetBits(keptBitMask);
  trader.shadeAndTrade(
    (tex) => CircuitShaders.qubitDensities(tex, keptBitMask),
    WglTexturePool.takeVec4Tex(
      startingQubitCount - 1 + ceilLg2(remainingQubitCount),
    ),
  );
}

/**
 * @param {!WglTextureTrader} trader
 * @param {!int} outCount The number of interleaved slices being summed.
 * The output will be a single row containing this many results (but padded up to a power of 2).
 */
function _sumDownVec4(trader, outCount) {
  // When the number of kept qubits isn't a power of 2, we have some extra junk results interleaved to ignore.
  const outputSizePower = ceilLg2(outCount);
  let curSizePower = currentShaderCoder().vec4.arrayPowerSizeOfTexture(
    trader.currentTexture,
  );

  while (curSizePower > outputSizePower) {
    trader.shadeHalveAndTrade(Shaders.sumFoldVec4);
    curSizePower -= 1;
  }
}

/**
 * @param {!Float32Array} buffer
 * @returns {!Array.<!Matrix>}
 */
KetTextureUtil.pixelsToQubitDensityMatrices = (buffer) => {
  const qubitCount = buffer.length / 4;
  return Array.from({ length: qubitCount }, (_, i) => {
    const a = buffer[i * 4];
    const d = buffer[i * 4 + 3];
    const unity = a + d;
    if (unity < 0.0000001 || Number.isNaN(unity)) {
      return new Matrix(
        2,
        2,
        new Float32Array([NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN]),
      );
    }

    const br = buffer[i * 4 + 1] / unity;
    const bi = buffer[i * 4 + 2] / unity;
    return new Matrix(
      2,
      2,
      new Float32Array([a / unity, 0, br, bi, br, -bi, d / unity, 0]),
    );
  });
};

/**
 * @param {!WglTexture} inputTexture
 * @returns {!WglConfiguredShader}
 */
const amplitudesToProbabilities = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.vec2("input")],
  Outputs.float(),
  `float outputFor(float k) {
        vec2 amp = read_input(k);
        return dot(amp, amp);
    }`,
);

/**
 * @param {!WglTexture} stateTex
 * @param {!boolean} mayHaveChanged
 * @returns {!WglTexture}
 */
KetTextureUtil.superpositionToNorm = (stateTex, mayHaveChanged) => {
  if (!mayHaveChanged) {
    return new WglTexture(0, 0, currentShaderCoder().vec4.pixelType);
  }
  const trader = new WglTextureTrader(stateTex);
  trader.dontDeallocCurrentTexture();
  let n = currentShaderCoder().vec2.arrayPowerSizeOfTexture(stateTex);

  trader.shadeAndTrade(
    amplitudesToProbabilities,
    WglTexturePool.takeVecFloatTex(n),
  );
  while (n > 0) {
    n -= 1;
    trader.shadeHalveAndTrade(Shaders.sumFoldFloat);
  }
  trader.shadeAndTrade(
    Shaders.packFloatIntoVec4,
    WglTexturePool.takeVec4Tex(0),
  );
  return trader.currentTexture;
};

export { KetTextureUtil };
