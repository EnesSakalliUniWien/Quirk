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
 * Switches for WebGL debugging. Mutated at runtime by the test harness.
 */
class Diagnostics {}

// Calling WebGLRenderingContext.getError forces a CPU/GPU sync. It's very expensive.
Diagnostics.CHECK_WEB_GL_ERRORS_EVEN_ON_HOT_PATHS = false;
Diagnostics.IGNORED_WEBGL_INFO_TERMS = [];
Diagnostics.SUPPRESSED_GLSL_WARNING_PATTERNS = [];

export {Diagnostics}
