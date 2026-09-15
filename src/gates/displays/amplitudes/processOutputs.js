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

import { Matrix } from "../../../engine/math/matrix/Matrix.js";

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

export { processOutputs };
