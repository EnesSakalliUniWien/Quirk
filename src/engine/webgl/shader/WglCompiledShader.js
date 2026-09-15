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
import { VERTEX_SHADER_SOURCE } from "./sources/vertexShaderSource.js";
import { FRAGMENT_SHADER_PRELUDE } from "./sources/fragmentShaderPrelude.js";

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
    const gl = initializedWglContext().gl;
    const glVertexShader = WglCompiledShader.compileShader(
      gl,
      GL.VERTEX_SHADER,
      VERTEX_SHADER_SOURCE,
    );
    const glFragmentShader = WglCompiledShader.compileShader(
      gl,
      GL.FRAGMENT_SHADER,
      FRAGMENT_SHADER_PRELUDE + fragmentShaderSource,
    );

    const program = gl.createProgram();
    gl.attachShader(program, glVertexShader);
    gl.attachShader(program, glFragmentShader);
    gl.linkProgram(program);
    // The program keeps what it needs; the shader objects can go either way.
    gl.deleteShader(glVertexShader);
    gl.deleteShader(glFragmentShader);

    // Note: MDN says the result of getProgramInfoLog is always a DOMString, but a user reported an
    // error where it returned null. So now we fallback to the empty string when getting a falsy value.
    const warnings = (gl.getProgramInfoLog(program) || "").trim();
    if (warnings !== "" && warnings !== "\0") {
      // The lone NUL happened in Ubuntu with an NVIDIA GK107GL.
      console.warn(
        "Shader compile caused warnings",
        "gl.getProgramInfoLog()",
        warnings,
      );
    }

    if (gl.getProgramParameter(program, GL.LINK_STATUS) === false) {
      const validateStatus = gl.getProgramParameter(program, GL.VALIDATE_STATUS);
      const error = gl.getError();
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
    this.uniformLocations = new Map(
      [...uniformParameterNames].map((e) => [
        e,
        gl.getUniformLocation(program, e),
      ]),
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
    const ctx = initializedWglContext();
    const gl = ctx.gl;
    gl.useProgram(this.program);

    const coop = { coopTextureUnit: 0 };
    for (const arg of uniformArgs) {
      const location = this.uniformLocations.get(arg.name);
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
    const gl = initializedWglContext().gl;
    gl.deleteProgram(this.program);
  }

  /**
   * @param {!WebGL2RenderingContext} gl
   * @param {number} shaderType
   * @param {!string} sourceCode
   * @returns {!WebGLShader}
   */
  static compileShader(gl, shaderType, sourceCode) {
    const shader = gl.createShader(shaderType);

    gl.shaderSource(shader, sourceCode);
    gl.compileShader(shader);

    const info = gl.getShaderInfoLog(shader) || "";
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

export { WglCompiledShader };
