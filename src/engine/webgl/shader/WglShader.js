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
import { Seq } from "../../../base/Seq.js";
import { WglArg } from "./WglArg.js";
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
    let gl = initializedWglContext().gl;

    let positionBuffer = gl.createBuffer();
    let positions = new Float32Array([-1, +1, +1, +1, -1, -1, +1, -1]);
    gl.bindBuffer(GL.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(GL.ARRAY_BUFFER, positions, GL.STATIC_DRAW);
    // Note: ARRAY_BUFFER should not be rebound anywhere else.

    let indexBuffer = gl.createBuffer();
    let indices = new Uint16Array([0, 2, 1, 2, 3, 1]);
    gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(GL.ELEMENT_ARRAY_BUFFER, indices, GL.STATIC_DRAW);
    // Note: ELEMENT_ARRAY_BUFFER should not be rebound anywhere else.

    return { positionBuffer, indexBuffer };
  },
  ({ positionBuffer, indexBuffer }) => {
    let gl = initializedWglContext().gl;
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(indexBuffer);
  },
);

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
precision highp int;
in vec2 position;
void main() {
  gl_Position = vec4(position, 0, 1);
}`;

/**
 * Everything a fragment shader body gets for free: GLSL ES 3.00, high precision, and the output
 * variable `fragColor` to write into.
 */
const FRAGMENT_SHADER_PRELUDE = `#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
`;

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
      let fixedSource = fragmentShaderSourceGenerator;
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
      let parameterNames = uniformArguments.map((e) => e.name);
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
      let ctx = initializedWglContext();
      let gl = ctx.gl;

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

/**
 * A compiled shader program definition that can be bound to / used by a webgl context.
 */
class WglCompiledShader {
  /**
   * @param {!string} fragmentShaderSource
   * @param {!Array.<!string>|!Iterable.<!string>} uniformParameterNames
   */
  constructor(fragmentShaderSource, uniformParameterNames) {
    const GL = WebGL2RenderingContext;
    let gl = initializedWglContext().gl;
    let glVertexShader = WglCompiledShader.compileShader(
      gl,
      GL.VERTEX_SHADER,
      VERTEX_SHADER_SOURCE,
    );
    let glFragmentShader = WglCompiledShader.compileShader(
      gl,
      GL.FRAGMENT_SHADER,
      FRAGMENT_SHADER_PRELUDE + fragmentShaderSource,
    );

    let program = gl.createProgram();
    gl.attachShader(program, glVertexShader);
    gl.attachShader(program, glFragmentShader);
    gl.linkProgram(program);
    // The program keeps what it needs; the shader objects can go either way.
    gl.deleteShader(glVertexShader);
    gl.deleteShader(glFragmentShader);

    // Note: MDN says the result of getProgramInfoLog is always a DOMString, but a user reported an
    // error where it returned null. So now we fallback to the empty string when getting a falsy value.
    let warnings = (gl.getProgramInfoLog(program) || "").trim();
    if (warnings !== "" && warnings !== "\0") {
      // The lone NUL happened in Ubuntu with an NVIDIA GK107GL.
      console.warn(
        "Shader compile caused warnings",
        "gl.getProgramInfoLog()",
        warnings,
      );
    }

    if (gl.getProgramParameter(program, GL.LINK_STATUS) === false) {
      let validateStatus = gl.getProgramParameter(program, GL.VALIDATE_STATUS);
      let error = gl.getError();
      gl.deleteProgram(program);
      throw new Error(
        "Failed to link shader program." +
          "\n\n" +
          `gl.VALIDATE_STATUS: ${validateStatus}` +
          "\n" +
          `gl.getError(): ${error}`,
      );
    }

    /** @type {!Map.<!string, !WebGLUniformLocation>} */
    this.uniformLocations = new Seq(uniformParameterNames).toMap(
      (e) => e,
      (e) => gl.getUniformLocation(program, e),
    );
    /** @type {!int} */
    this.positionAttributeLocation = gl.getAttribLocation(program, "position");
    /** @type {!WebGLProgram} */
    this.program = program;
  }

  /**
   * @param {!(!WglArg[])} uniformArgs
   * @return {void}
   */
  useWithArgs(uniformArgs) {
    let ctx = initializedWglContext();
    let gl = ctx.gl;
    gl.useProgram(this.program);

    let coop = { coopTextureUnit: 0 };
    for (let arg of uniformArgs) {
      let location = this.uniformLocations.get(arg.name);
      if (location === undefined) {
        throw new DetailedError("Unexpected uniform argument", {
          arg,
          uniformArgs,
        });
      }
      WglArg.INPUT_ACTION_MAP.get(arg.type)(ctx, location, arg.value, coop);
    }

    gl.enableVertexAttribArray(this.positionAttributeLocation);
    gl.vertexAttribPointer(
      this.positionAttributeLocation,
      2,
      WebGL2RenderingContext.FLOAT,
      false,
      0,
      0,
    );
  }

  free() {
    let gl = initializedWglContext().gl;
    gl.deleteProgram(this.program);
  }

  /**
   * @param {!WebGL2RenderingContext} gl
   * @param {number} shaderType
   * @param {!string} sourceCode
   * @returns {!WebGLShader}
   */
  static compileShader(gl, shaderType, sourceCode) {
    let shader = gl.createShader(shaderType);

    gl.shaderSource(shader, sourceCode);
    gl.compileShader(shader);

    let info = gl.getShaderInfoLog(shader) || "";
    if (info !== "") {
      console.warn("WebGLShader: gl.getShaderInfoLog() wasn't empty: " + info);
      console.warn("Source code was: " + sourceCode);
    }

    if (
      gl.getShaderParameter(shader, WebGL2RenderingContext.COMPILE_STATUS) ===
      false
    ) {
      gl.deleteShader(shader);
      throw new Error(`WebGLShader: Shader compile failed.
                Info: ${info}
                Source: ${sourceCode}`);
    }

    return shader;
  }
}

export { WglShader };
