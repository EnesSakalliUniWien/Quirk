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

import { Complex } from "../complex/Complex.js";

/**
 * Encodes vectors into JSON that could easily be read by humans or processed by external programs.
 */
class ReadableJson {
  /**
   * @param {!Iterable.<!Complex>} vector
   * @returns {!Array.<!{r: !number, i: !number}>}
   */
  static complexVector(vector) {
    return [...vector].map((e) => ({
      r: Complex.realPartOf(e),
      i: Complex.imagPartOf(e),
    }));
  }

  /**
   * @param {!Iterable.<!Complex>} vector
   * @returns {!Array.<!number>}
   */
  static realVector(vector) {
    return [...vector].map((e) => Complex.realPartOf(e));
  }
}

export { ReadableJson };
