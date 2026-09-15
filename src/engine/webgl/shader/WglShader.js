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

import { WglCompiledShader } from "./WglCompiledShader.js";

/** @typedef {import("./WglArg.js").WglArg} WglArg */
import { initializedWglContext } from "../context/WglContext.js";
import { WglMortalValueSlot } from "../context/WglMortalValueSlot.js";
import {
  checkGetErrorResult,
  checkFrameBufferStatusResult,
} from "../context/WglUtil.js";
import { WglConfiguredShader } from "./WglConfiguredShader.js";

/**
 * The full-screen quad every fragment shader is drawn over.
 * @type {!WglMortalValueSlot.<!{positionBuffer: !WebGLBuffer, indexBuffer: !WebGLBuffer}>}
 */
const ENSURE_ATTRIBUTES_BOUND_SLOT = new WglMortalValueSlot(
  () => {
    const GL = WebGL2RenderingContext;
    const gl = initializedWglContext().gl;

    const positionBuffer = gl.createBuffer();
    const positions = new Float32Array([-1, +1, +1, +1, -1, -1, +1, -1]);
    gl.bindBuffer(GL.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(GL.ARRAY_BUFFER, positions, GL.STATIC_DRAW);
    // Note: ARRAY_BUFFER should not be rebound anywhere else.

    const indexBuffer = gl.createBuffer();
    const indices = new Uint16Array([0, 2, 1, 2, 3, 1]);
    gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(GL.ELEMENT_ARRAY_BUFFER, indices, GL.STATIC_DRAW);
    // Note: ELEMENT_ARRAY_BUFFER should not be rebound anywhere else.

    return { positionBuffer, indexBuffer };
  },
  ({ positionBuffer, indexBuffer }) => {
    const gl = initializedWglContext().gl;
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(indexBuffer);
  },
);

/**
 * A shader program definition, used to render outputs onto textures based on the given GLSL source code.
 *
 * The source is a GLSL ES 3.00 fragment shader body without a version line or precision
 * qualifiers; write results to `fragColor`.
 */
class WglShader {
  /**
   * @param {!string|!function() : !string} fragmentShaderSourceGenerator
   */
  constructor(fragmentShaderSourceGenerator) {
    if (typeof fragmentShaderSourceGenerator === "string") {
      const fixedSource = fragmentShaderSourceGenerator;
      fragmentShaderSourceGenerator = () => fixedSource;
    }

    /** @type {!function() : !string} */
    this.fragmentShaderSourceGenerator = fragmentShaderSourceGenerator;
    /** @type {undefined|!WglMortalValueSlot.<!WglCompiledShader>} */
    this._compiledShaderSlot = undefined; // Wait for someone to tell us the parameter names.
  }

  /**
   * Returns the same shader, but parameterized by the given arguments. Call renderTo on the result to render to a
   * destination texture.
   *
   * The first call fixes the set of uniform names the program is compiled with; later calls must
   * pass the same names.
   * @param {!WglArg} uniformArguments
   * @returns {!WglConfiguredShader}
   */
  withArgs(...uniformArguments) {
    // Learn the parameter names.
    if (this._compiledShaderSlot === undefined) {
      const parameterNames = uniformArguments.map((e) => e.name);
      this._compiledShaderSlot = new WglMortalValueSlot(
        () =>
          new WglCompiledShader(
            this.fragmentShaderSourceGenerator(),
            parameterNames,
          ),
        (compiledShader) => compiledShader.free(),
      );
    }

    return new WglConfiguredShader((texture) => {
      if (texture.width === 0 || texture.height === 0) {
        return;
      }

      const GL = WebGL2RenderingContext;
      const ctx = initializedWglContext();
      const gl = ctx.gl;

      ENSURE_ATTRIBUTES_BOUND_SLOT.ensureInitialized(ctx.lifetimeCounter);

      // Bind frame buffer.
      gl.bindFramebuffer(GL.FRAMEBUFFER, texture.initializedFramebuffer());
      checkGetErrorResult(gl, "framebufferTexture2D", true);
      checkFrameBufferStatusResult(gl, true);

      // Compile and bind shader.
      this._compiledShaderSlot
        .initializedValue(ctx.lifetimeCounter)
        .useWithArgs(uniformArguments);

      gl.viewport(0, 0, texture.width, texture.height);
      gl.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
      checkGetErrorResult(gl, "drawElements", true);
      texture.markRendered();
    });
  }

  ensureDeinitialized() {
    if (this._compiledShaderSlot !== undefined) {
      this._compiledShaderSlot.ensureDeinitialized();
    }
  }

  toString() {
    return `WglShader(fragmentShaderSource: ${this.fragmentShaderSourceGenerator()})`;
  }
}

export { WglShader };
