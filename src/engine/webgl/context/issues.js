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

/**
 * The one canvas and WebGL2 context the whole application renders with. Created once, at import,
 * so that every texture and shader shares a single GL state.
 */
const sharedCanvas = document.createElement("canvas");
const sharedContext = sharedCanvas.getContext("webgl2");

/**
 * Explains why the simulation cannot run on this browser, or returns undefined when it can.
 *
 * The engine needs WebGL2, float render targets and readback (EXT_color_buffer_float), and high
 * precision floats in fragment shaders, because amplitudes are addressed and stored as 32-bit floats.
 * @returns {undefined|!string}
 */
function webGl2SupportProblem() {
  if (sharedContext === null || sharedContext === undefined) {
    return "Your browser doesn't support WebGL2, or has it disabled.";
  }
  if (sharedContext.getExtension("EXT_color_buffer_float") === null) {
    return "Your GPU can't render to floating point textures (EXT_color_buffer_float is missing).";
  }
  const GL = WebGL2RenderingContext;
  let format = sharedContext.getShaderPrecisionFormat(GL.FRAGMENT_SHADER, GL.HIGH_FLOAT);
  if (format === null || format.precision === 0) {
    return "Your GPU doesn't support high precision floats in fragment shaders.";
  }
  return undefined;
}

/** @returns {!boolean} */
function detectWebGlNotSupported() {
  return webGl2SupportProblem() !== undefined;
}

export { detectWebGlNotSupported, webGl2SupportProblem, sharedCanvas, sharedContext };
