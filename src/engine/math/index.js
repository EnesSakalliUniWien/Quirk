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
 * The math namespace. Its three sub-namespaces layer strictly: complex, then formula, then matrix.
 *
 * Import the owning file directly for a single symbol; import an index to refer to a namespace.
 */
export * from "./complex/index.js";
export * from "./formula/index.js";
export * from "./matrix/index.js";
