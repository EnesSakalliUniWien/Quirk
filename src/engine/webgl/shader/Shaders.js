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
import { WglArg } from "./WglArg.js";
import { initializedWglContext } from "../context/WglContext.js";
import { WglShader } from "./WglShader.js";
import { WglConfiguredShader } from "./WglConfiguredShader.js";
import {
  currentShaderCoder,
  Inputs,
  Outputs,
  makePseudoShaderWithInputsAndOutputAndCode,
} from "../coder/ShaderCoders.js";

/**
 * Utilities for creating/configuring shaders that render various simple things.
 */
class Shaders {}

/**
 * Returns a configured shader that renders a uniform color over the entire destination texture.
 * @param {!number} r
 * @param {!number} g
 * @param {!number} b
 * @param {!number} a
 * @returns {!WglConfiguredShader}
 */
Shaders.color = (r, g, b, a) =>
  COLOR_SHADER.withArgs(WglArg.vec4("color", r, g, b, a));
const COLOR_SHADER = new WglShader(`
    uniform vec4 color;
    void main() {
        fragColor = color;
    }`);

/**
 * Returns a configured shader that just draws the input texture's contents.
 * @param {!WglTexture} inp
 * @returns {!WglConfiguredShader}
 */
Shaders.passthrough = (inp) =>
  new WglConfiguredShader((dst) => {
    if (
      dst.width !== inp.width ||
      dst.height !== inp.height ||
      dst.pixelType !== inp.pixelType
    ) {
      throw new DetailedError("Expected same-shaped textures.", { inp, dst });
    }
    PASSTHROUGH_SHADER.withArgs(WglArg.texture("dataTexture", inp)).renderTo(
      dst,
    );
  });
const PASSTHROUGH_SHADER = new WglShader(`
    uniform sampler2D dataTexture;
    void main() {
        fragColor = texelFetch(dataTexture, ivec2(gl_FragCoord.xy), 0);
    }`);

/**
 * Returns a configured shader that overlays the destination texture with the given data.
 * @param {!Float32Array|!Uint8Array} rgbaData
 * @returns {!WglConfiguredShader}
 */
Shaders.data = (rgbaData) =>
  new WglConfiguredShader((destinationTexture) => {
    const [w, h] = [destinationTexture.width, destinationTexture.height];
    if (rgbaData.length !== w * h * 4) {
      throw new DetailedError("rgbaData.length isn't w * h * 4", {
        w,
        h,
        len: rgbaData.length,
        rgbaData,
      });
    }

    const GL = WebGL2RenderingContext;
    const gl = initializedWglContext().gl;
    const isBytes = rgbaData instanceof Uint8Array;
    const dataTexture = gl.createTexture();
    try {
      gl.bindTexture(GL.TEXTURE_2D, dataTexture);
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
      gl.texImage2D(
        GL.TEXTURE_2D,
        0,
        isBytes ? GL.RGBA8 : GL.RGBA32F,
        w,
        h,
        0,
        GL.RGBA,
        isBytes ? GL.UNSIGNED_BYTE : GL.FLOAT,
        rgbaData,
      );
      PASSTHROUGH_SHADER.withArgs(
        WglArg.webGlTexture("dataTexture", dataTexture),
      ).renderTo(destinationTexture);
    } finally {
      gl.deleteTexture(dataTexture);
    }
  });

/**
 * Returns a configured shader that overlays the destination texture with the given float data.
 * @param {!Float32Array} floats
 * @returns {!WglConfiguredShader}
 */
Shaders.floatData = (floats) =>
  Shaders.data(currentShaderCoder().float.dataToPixels(floats));

/**
 * Returns a configured shader that overlays the destination texture with the given vec2 data.
 * @param {!Float32Array} floats
 * @returns {!WglConfiguredShader}
 */
Shaders.vec2Data = (floats) =>
  Shaders.data(currentShaderCoder().vec2.dataToPixels(floats));

/**
 * Returns a configured shader that overlays the destination texture with the given vec4 data.
 * @param {!Float32Array} floats
 * @returns {!WglConfiguredShader}
 */
Shaders.vec4Data = (floats) =>
  Shaders.data(currentShaderCoder().vec4.dataToPixels(floats));

/**
 * Packs four consecutive floats from the input into each vec4 pixel of the output.
 * @param {!WglTexture} input
 * @returns {!WglConfiguredShader}
 */
Shaders.packFloatIntoVec4 = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.float("input")],
  Outputs.vec4(),
  `vec4 outputFor(float k) {
        return vec4(
            read_input(k*4.0),
            read_input(k*4.0 + 1.0),
            read_input(k*4.0 + 2.0),
            read_input(k*4.0 + 3.0));
    }`,
);

/**
 * Packs two consecutive vec2s from the input into each vec4 pixel of the output.
 * @param {!WglTexture} input
 * @returns {!WglConfiguredShader}
 */
Shaders.packVec2IntoVec4 = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.vec2("input")],
  Outputs.vec4(),
  "vec4 outputFor(float k) { return vec4(read_input(k*2.0), read_input(k*2.0 + 1.0)); }",
);

/**
 * Adds the second half of its input into the first half.
 * @param {!WglTexture} inp
 * @returns {!WglConfiguredShader}
 */
Shaders.sumFoldFloat = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.float("input")],
  Outputs.float(),
  `float outputFor(float k) {
         return read_input(k) + read_input(k + len_output());
     }`,
);

/**
 * Adds the odd half of its input to the even half of its input.
 * @param {!WglTexture} inp
 * @returns {!WglConfiguredShader}
 */
Shaders.sumFoldFloatAdjacents = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.float("input")],
  Outputs.float(),
  `float outputFor(float k) {
         return read_input(k*2.0) + read_input(k*2.0 + 1.0);
     }`,
);

/**
 * Adds the second half of its input into the first half.
 * @param {!WglTexture} inp
 * @returns {!WglConfiguredShader}
 */
Shaders.sumFoldVec2 = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.vec2("input")],
  Outputs.vec2(),
  `vec2 outputFor(float k) {
         return read_input(k) + read_input(k + len_output());
     }`,
);

/**
 * Adds the odd half of its input to the even half of its input.
 * @param {!WglTexture} inp
 * @returns {!WglConfiguredShader}
 */
Shaders.sumFoldVec2Adjacents = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.vec2("input")],
  Outputs.vec2(),
  `vec2 outputFor(float k) {
         return read_input(k*2.0) + read_input(k*2.0 + 1.0);
     }`,
);

/**
 * Adds the second half of its input into the first half.
 * @param {!WglTexture} inp
 * @returns {!WglConfiguredShader}
 */
Shaders.sumFoldVec4 = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.vec4("input")],
  Outputs.vec4(),
  `vec4 outputFor(float k) {
        return read_input(k) + read_input(k + len_output());
    }`,
);

export { Shaders };
