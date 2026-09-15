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

import { Registers } from "../../circuit/model/Registers.js";
import { DetailedError } from "../../base/DetailedError.js";

/**
 * A register as JSON: its name, its wires as [first, count], the input it feeds when it feeds one,
 * and the labels of its values when it has any.
 *
 * @param {!Register} register
 * @returns {!object}
 */
function toJson_Register(register) {
  const result = {
    name: register.name,
    wires: [register.start, register.length],
  };
  if (register.input !== undefined) {
    result.input = register.input;
  }
  if (register.labels !== undefined) {
    result.labels = { ...register.labels };
  }
  return result;
}

/**
 * @param {object} json
 * @returns {!Registers}
 * @throws
 */
function _fromJson_Registers(json) {
  const { registers } = json;
  if (registers === undefined) {
    return Registers.EMPTY;
  }
  if (!Array.isArray(registers)) {
    throw new DetailedError("Registers must be an array.", { json });
  }
  const list = registers.map((e) => {
    if (
      e === null ||
      typeof e !== "object" ||
      !Array.isArray(e.wires) ||
      e.wires.length !== 2
    ) {
      throw new DetailedError(
        "A register needs a name and its wires as [first, count].",
        { register: e },
      );
    }
    return {
      name: e.name,
      start: e.wires[0],
      length: e.wires[1],
      input: e.input,
      labels: e.labels,
    };
  });
  const problem = Registers.problemWith(list);
  if (problem !== undefined) {
    throw new DetailedError(problem, { registers });
  }
  return new Registers(list);
}

export { toJson_Register, _fromJson_Registers };
