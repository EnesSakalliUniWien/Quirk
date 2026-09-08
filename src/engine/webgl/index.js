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
 * The webgl namespace: the WebGL2 backend, grouped by responsibility.
 *
 *   context   the one shared GL context, its loss and recovery, error checking
 *   shader    programs, their uniform arguments, and the standard shader library
 *   texture   GPU memory: textures, the reuse pool, and the trader that chains shaders over them
 *   coder     how float, vec2, vec4 and bool arrays are laid out in textures and addressed in GLSL
 *
 * Import the owning file directly for a single symbol; import this index to refer to the namespace.
 */
export { webGl2SupportProblem } from "./context/issues.js";
export { initializedWglContext } from "./context/WglContext.js";
export { WglArg } from "./shader/WglArg.js";
export { WglShader } from "./shader/WglShader.js";
export { WglConfiguredShader } from "./shader/WglConfiguredShader.js";
export { Shaders } from "./shader/Shaders.js";
export { WglTexture } from "./texture/WglTexture.js";
export { WglTexturePool } from "./texture/WglTexturePool.js";
export { WglTextureTrader } from "./texture/WglTextureTrader.js";
export {
  currentShaderCoder,
  Inputs,
  Outputs,
  makePseudoShaderWithInputsAndOutputAndCode,
} from "./coder/ShaderCoders.js";
