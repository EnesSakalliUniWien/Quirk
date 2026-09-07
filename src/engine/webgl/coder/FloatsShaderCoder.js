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
import {
  ShaderPart,
  SingleTypeCoder,
  ShaderCoder,
  BOOL_TYPE_CODER,
  TEXEL_ADDRESSING_CODE,
  outputPreludeCode,
  outputArgsFor,
} from "./ShaderCoderTypes.js";
import { WglArg } from "../shader/WglArg.js";

/**
 * @param {!int} vecSize
 * @param {!string} name
 * @returns {!ShaderPart}
 */
function makeFloatCoderInput(vecSize, name) {
  let type = ["float", "vec2", "vec3", "vec4"][vecSize - 1];
  let pre = `_gen_${name}`;
  return new ShaderPart(
    `
        ///////////// makeFloatCoderInput(${vecSize}, ${name}) ////////////
        uniform sampler2D ${pre}_tex;

        ${type} read_${name}(float k) {
            return texelFetch(${pre}_tex, _gen_texelFor(${pre}_tex, k), 0).${"xyzw".substring(0, vecSize)};
        }

        float len_${name}() {
            ivec2 size = textureSize(${pre}_tex, 0);
            return float(size.x * size.y);
        }`,
    [TEXEL_ADDRESSING_CODE],
    (texture) => {
      if (texture.pixelType !== WebGL2RenderingContext.FLOAT) {
        throw new DetailedError(
          `vecInput${vecSize}_Float requires float texture`,
          { name, texture },
        );
      }
      return [WglArg.texture(`${pre}_tex`, texture)];
    },
  );
}

/**
 * @param {!int} vecSize
 * @returns {!ShaderPart}
 */
function makeFloatCoderOutput(vecSize) {
  let type = ["float", "vec2", "vec3", "vec4"][vecSize - 1];
  let vIntoVec4 = [
    "vec4(v, 0.0, 0.0, 0.0)",
    "vec4(v.x, v.y, 0.0, 0.0)",
    "vec4(v.x, v.y, v.z, 0.0)",
    "v",
  ][vecSize - 1];
  return new ShaderPart(
    `
        ///////////// makeFloatCoderOutput${vecSize} ////////////
        ${outputPreludeCode(type)}

        void main() {
            ${type} v = outputFor(_gen_outputIndex());
            fragColor = ${vIntoVec4};
        }`,
    [],
    outputArgsFor,
  );
}

/**
 * @param {!Float32Array} vec1Data
 * @returns {!Float32Array}
 */
function spreadFloatVec1(vec1Data) {
  let result = new Float32Array(vec1Data.length << 2);
  for (let i = 0; i < vec1Data.length; i++) {
    result[4 * i] = vec1Data[i];
  }
  return result;
}

/**
 * @param {!Float32Array} vec2Data
 * @returns {!Float32Array}
 */
function spreadFloatVec2(vec2Data) {
  let result = new Float32Array(vec2Data.length << 1);
  for (let i = 0; i * 2 < vec2Data.length; i++) {
    result[4 * i] = vec2Data[2 * i];
    result[4 * i + 1] = vec2Data[2 * i + 1];
  }
  return result;
}

/**
 * @param {!Float32Array} pixelData
 * @returns {!Float32Array}
 */
function unspreadFloatVec1(pixelData) {
  let result = new Float32Array(pixelData.length >> 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = pixelData[4 * i];
  }
  return result;
}

/**
 * @param {!Float32Array} pixelData
 * @returns {!Float32Array}
 */
function unspreadFloatVec2(pixelData) {
  let result = new Float32Array(pixelData.length >> 1);
  for (let i = 0; i * 2 < result.length; i++) {
    result[2 * i] = pixelData[4 * i];
    result[2 * i + 1] = pixelData[4 * i + 1];
  }
  return result;
}

const FLOAT_TYPE_CODER = new SingleTypeCoder(
  (name) => makeFloatCoderInput(1, name),
  makeFloatCoderOutput(1),
  0,
  WebGL2RenderingContext.FLOAT,
  spreadFloatVec1,
  unspreadFloatVec1,
  true,
);

const VEC2_TYPE_CODER = new SingleTypeCoder(
  (name) => makeFloatCoderInput(2, name),
  makeFloatCoderOutput(2),
  0,
  WebGL2RenderingContext.FLOAT,
  spreadFloatVec2,
  unspreadFloatVec2,
  true,
);

const VEC4_TYPE_CODER = new SingleTypeCoder(
  (name) => makeFloatCoderInput(4, name),
  makeFloatCoderOutput(4),
  0,
  WebGL2RenderingContext.FLOAT,
  (e) => e,
  (e) => e,
  false,
);

/**
 * The coder that stores every value type in RGBA32F textures, one value per pixel.
 * @type {!ShaderCoder}
 */
const SHADER_CODER_FLOATS = new ShaderCoder(
  BOOL_TYPE_CODER,
  FLOAT_TYPE_CODER,
  VEC2_TYPE_CODER,
  VEC4_TYPE_CODER,
);

export { SHADER_CODER_FLOATS };
