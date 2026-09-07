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
 * The engine namespace: every calculation Quirk performs, from complex numbers to the GPU
 * simulation of a circuit. Its three sub-namespaces layer strictly:
 *
 *   math        pure value types and numerics, no GPU, no circuit knowledge
 *   webgl       the WebGL backend: context, shaders, textures, float encodings
 *   simulation  the circuit simulation built on both: kets, gate shaders, statistics
 *
 * Import the owning file directly for a single symbol; import an index to refer to a namespace.
 */
export * from "./math/index.js";
export { Shaders } from "./webgl/shader/Shaders.js";
export { WglTexture } from "./webgl/texture/WglTexture.js";
export { WglTexturePool } from "./webgl/texture/WglTexturePool.js";
export { WglTextureTrader } from "./webgl/texture/WglTextureTrader.js";
export { CircuitEvalContext } from "./simulation/CircuitEvalContext.js";
export { CircuitStats } from "./simulation/CircuitStats.js";
export { CircuitShaders } from "./simulation/gpu/CircuitShaders.js";
export { GateShaders } from "./simulation/gpu/GateShaders.js";
export { KetTextureUtil } from "./simulation/gpu/KetTextureUtil.js";
