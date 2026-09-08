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

import { WglArg } from "../shader/WglArg.js";

/**
 * A piece of a shader.
 *
 * Inputs and outputs are read from and written to textures. Instead of having every shader spell
 * out the addressing, the conversion functionality is abstracted into parts that are combined with
 * the shader body.
 */
class ShaderPart {
  /**
   * @param {!string} code
   * @param {!Array.<!string>} libs
   * @param {!function(!WglTexture) : !Array.!<WglArg>} argsFor
   */
  constructor(code, libs, argsFor) {
    /** @type {!string} */
    this.code = code;
    /** @type {!Array.<!string>} */
    this.libs = libs;
    /** @type {!function(!WglTexture) : !Array.!<WglArg>} */
    this.argsFor = argsFor;
  }
}

/**
 * A strategy for converting and shading with a specific type of value array.
 */
class SingleTypeCoder {
  /**
   * @param {!function(name: !string) : !ShaderPart} inputPartGetter Determines how values are decoded from the
   *     various given input textures while rendering.
   * @param {!ShaderPart} outputPart Determines how computed values are encoded into the next texture while rendering.
   * @param {!int} powerSizeOverhead This value is the k in the 2^k * N texture area (pixels) it takes to encode N
   *     values.
   * @param {!int} pixelType Determines whether encoding goes into float or byte textures.
   * @param {!function(*) : !Float32Array|!Uint8Array} dataToPixels Converts from tightly packed data into the data
   *     that would be returned by readPixels (or that should be written into a texture encoding the data).
   * @param {!function(!Float32Array|!Uint8Array) : *} pixelsToData Converts from raw pixel data returned by
   *     readPixels into tightly packed data.
   * @param {!boolean} needRearrangingToBeInVec4Format Determines if the encoded values will be spread out instead of
   *     packed together tightly when readPixels is called. Code trying to minimize the time spent blocked on
   *     readPixels uses this as a hint to rearrange the data before reading it.
   */
  constructor(
    inputPartGetter,
    outputPart,
    powerSizeOverhead,
    pixelType,
    dataToPixels,
    pixelsToData,
    needRearrangingToBeInVec4Format,
  ) {
    /** @type {!function(name: !string) : !ShaderPart} */
    this.inputPartGetter = inputPartGetter;
    /** @type {!ShaderPart} */
    this.outputPart = outputPart;
    /** @type {!int} */
    this.powerSizeOverhead = powerSizeOverhead;
    /** @type {!int} */
    this.pixelType = pixelType;
    /** @type {!function(*) : !Float32Array|!Uint8Array} */
    this.dataToPixels = dataToPixels;
    /** @type {!function(!Float32Array|!Uint8Array) : *} */
    this.pixelsToData = pixelsToData;
    /** @type {!boolean} */
    this.needRearrangingToBeInVec4Format = needRearrangingToBeInVec4Format;
  }

  /**
   * @param {!WglTexture} tex
   * @returns {!int}
   */
  arrayPowerSizeOfTexture(tex) {
    return Math.max(0, tex.sizePower() - this.powerSizeOverhead);
  }
}

/**
 * A strategy for converting between values used inside the shader and the textures those values must live in between
 * shaders.
 */
class ShaderCoder {
  /**
   * @param {!SingleTypeCoder} bool
   * @param {!SingleTypeCoder} float
   * @param {!SingleTypeCoder} vec2
   * @param {!SingleTypeCoder} vec4
   */
  constructor(bool, float, vec2, vec4) {
    /** @type {!SingleTypeCoder} */
    this.bool = bool;
    /** @type {!SingleTypeCoder} */
    this.float = float;
    /** @type {!SingleTypeCoder} */
    this.vec2 = vec2;
    /** @type {!SingleTypeCoder} */
    this.vec4 = vec4;
  }
}

/**
 * GLSL that turns a float array index into the integer texel coordinate holding it.
 * The index arrives as a float because shader bodies compute indices with float arithmetic.
 */
const TEXEL_ADDRESSING_CODE = `
    //////////// TEXEL_ADDRESSING /////////////
    ivec2 _gen_texelFor(sampler2D tex, float k) {
        int i = int(k + 0.5);
        int w = textureSize(tex, 0).x;
        return ivec2(i % w, i / w);
    }`;

/**
 * GLSL that computes the output index of the fragment being shaded.
 * Declares outputFor for the body to implement and len_output for it to call.
 * @param {!string} type The GLSL type the body's outputFor returns.
 * @returns {!string}
 */
function outputPreludeCode(type) {
  return `
        ${type} outputFor(float k);

        uniform vec2 _gen_output_size;

        float len_output() {
            return _gen_output_size.x * _gen_output_size.y;
        }

        float _gen_outputIndex() {
            ivec2 xy = ivec2(gl_FragCoord.xy);
            return float(xy.y * int(_gen_output_size.x) + xy.x);
        }`;
}

/**
 * @param {!WglTexture} texture
 * @returns {!Array.<!WglArg>}
 */
function outputArgsFor(texture) {
  return [WglArg.vec2("_gen_output_size", texture.width, texture.height)];
}

/**
 * @param {!string} name
 * @returns {!ShaderPart}
 */
function boolInputPartGetter(name) {
  const pre = `_gen_${name}`;
  return new ShaderPart(
    `
        ///////////// boolInput(${name}) ////////////
        uniform sampler2D ${pre}_tex;

        float read_${name}(float k) {
            return float(texelFetch(${pre}_tex, _gen_texelFor(${pre}_tex, k), 0).x == 1.0);
        }

        float len_${name}() {
            ivec2 size = textureSize(${pre}_tex, 0);
            return float(size.x * size.y * 4);
        }`,
    [TEXEL_ADDRESSING_CODE],
    (texture) => [WglArg.texture(`${pre}_tex`, texture)],
  );
}

const BOOL_OUTPUT_PART = new ShaderPart(
  `
    ///////////// BOOL_OUTPUT_AS_FLOAT ////////////
    ${outputPreludeCode("bool")}

    void main() {
        fragColor = vec4(float(outputFor(_gen_outputIndex())), 0.0, 0.0, 0.0);
    }`,
  [],
  outputArgsFor,
);

const BOOL_TYPE_CODER = new SingleTypeCoder(
  boolInputPartGetter,
  BOOL_OUTPUT_PART,
  0,
  WebGL2RenderingContext.UNSIGNED_BYTE,
  (e) => e,
  (e) => e,
  false,
);

export {
  SingleTypeCoder,
  ShaderCoder,
  ShaderPart,
  BOOL_TYPE_CODER,
  TEXEL_ADDRESSING_CODE,
  outputPreludeCode,
  outputArgsFor,
};
