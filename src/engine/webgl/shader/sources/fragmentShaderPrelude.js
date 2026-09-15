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
 * Everything a fragment shader body gets for free: GLSL ES 3.00, high precision, and the output
 * variable `fragColor` to write into.
 */
const FRAGMENT_SHADER_PRELUDE = `#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
`;

export { FRAGMENT_SHADER_PRELUDE };
