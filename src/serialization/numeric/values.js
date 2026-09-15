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

import { Format } from "../../base/Format.js";
import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { ComplexFormula } from "../../engine/math/formula/ComplexFormula.js";

/**
 * @param {!Complex} v
 * @returns {!object}
 */
function toJson_Complex(v) {
  return v.toString(Format.MINIFIED);
}

/**
 * @param {object} json
 * @returns {!Complex}
 * @throws {Error}
 */
function fromJson_Complex(json) {
  if (typeof json === "string") {
    return ComplexFormula.parse(json);
  }
  throw new Error("Not a packed complex string: " + json);
}

/**
 * @param {!Matrix} v
 * @returns {!object}
 */
function toJson_Matrix(v) {
  return v.toString(Format.MINIFIED);
}

/**
 * @param {object} json
 * @returns {!Matrix}
 * @throws {Error}
 */
function fromJson_Matrix(json) {
  if (typeof json !== "string") {
    throw new Error("Not a packed matrix string: " + json);
  }
  return Matrix.parse(/** @type {!string} */ json);
}

export { toJson_Complex, fromJson_Complex, toJson_Matrix, fromJson_Matrix };
