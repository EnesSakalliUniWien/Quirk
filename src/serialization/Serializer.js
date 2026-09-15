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

import { CircuitDefinition } from "../circuit/model/CircuitDefinition.js";
import { Complex } from "../engine/math/complex/Complex.js";
import { Matrix } from "../engine/math/matrix/Matrix.js";
import { Gate } from "../circuit/model/Gate.js";
import { GateColumn } from "../circuit/model/GateColumn.js";
import { describe } from "../base/Describe.js";
import { toJson_Complex, fromJson_Complex, toJson_Matrix, fromJson_Matrix } from "./numeric/values.js";
import { toJson_Gate, fromJson_Gate } from "./gates/gate.js";
import { toJson_GateColumn, fromJson_GateColumn } from "./gates/collections.js";
import { toJson_CircuitDefinition, fromJson_CircuitDefinition } from "./circuits/circuit.js";

/**
 * Serializes supported values to/from json elements.
 */
class Serializer {
  /**
   * @param {*} value
   * @param {*=undefined} context
   * @returns {*}
   */
  static toJson(value, context = undefined) {
    for (const [type, toJ, _] of BINDINGS) {
      if (value instanceof type) {
        return toJ(value, context);
      }
    }
    throw new Error(`Don't know how to convert ${describe(value)} to JSON.`);
  }

  /**
   * @param {*} expectedType
   * @param {*} json
   * @param {*=undefined} context
   * @returns {*}
   */
  static fromJson(expectedType, json, context = undefined) {
    for (const [type, _, fromJ] of BINDINGS) {
      if (type === expectedType) {
        return fromJ(json, context);
      }
    }
    throw new Error(
      `Don't know how to deserialize JSON ${describe(json)} into an instance of ${expectedType}.`,
    );
  }
}

const BINDINGS = [
  [Complex, toJson_Complex, fromJson_Complex],
  [Gate, toJson_Gate, fromJson_Gate],
  [Matrix, toJson_Matrix, fromJson_Matrix],
  [GateColumn, toJson_GateColumn, fromJson_GateColumn],
  [CircuitDefinition, toJson_CircuitDefinition, fromJson_CircuitDefinition],
];

export { Serializer };
