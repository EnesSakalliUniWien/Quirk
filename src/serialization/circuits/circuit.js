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

import { CircuitDefinition } from "../../circuit/model/CircuitDefinition.js";
import { CustomGateSet } from "../../circuit/model/CustomGateSet.js";
import { GateColumn } from "../../circuit/model/GateColumn.js";
import { Simulation } from "../../config/Simulation.js";
import { describe } from "../../base/Describe.js";
import { toJson_GateColumn, fromJson_GateColumn, toJson_CustomGateSet, fromJson_CustomGateSet } from "../gates/collections.js";
import { toJson_Register, _fromJson_Registers } from "./registers.js";
import { toJson_InitialState, _fromJson_InitialState } from "./initialState.js";

/**
 * @param {!CircuitDefinition} v
 * @param {undefined|!CustomGateSet} context
 * @returns {!object}
 */
function toJson_CircuitDefinition(v, context) {
  const result = {
    cols: v
      .trimEmptyColumnsAtEndIgnoringGateWidths()
      .columns.map((e) => toJson_GateColumn(e, context || v.customGateSet))
      .map((c) => {
        // Trailing 1s are the default gate weight, so the JSON leaves them out.
        let end = c.length;
        while (end > 0 && c[end - 1] === 1) {
          end -= 1;
        }
        return c.slice(0, end);
      }),
  };
  if (context === undefined && v.customGateSet.gates.length > 0) {
    result.gates = toJson_CustomGateSet(v.customGateSet);
  }
  if (v.customInitialValues.size > 0) {
    result.init = toJson_InitialState(v.customInitialValues);
  }
  if (!v.registers.isEmpty()) {
    result.registers = v.registers.list.map(toJson_Register);
  }
  return result;
}

/**
 * @param {object} json
 * @param {undefined|!CustomGateSet} context
 * @returns {!CircuitDefinition}
 * @throws
 */
function fromJson_CircuitDefinition(json, context = undefined) {
  const { cols } = json;
  const customGateSet =
    context ||
    (json.gates === undefined
      ? new CustomGateSet()
      : fromJson_CustomGateSet(json.gates));

  if (!Array.isArray(cols)) {
    throw new Error(
      `CircuitDefinition json should contain an array of cols. Json: ${describe(json)}`,
    );
  }
  let gateCols = cols.map((e) => fromJson_GateColumn(e, customGateSet));

  const initialValues = _fromJson_InitialState(json);
  const registers = _fromJson_Registers(json);

  let numWires = 0;
  for (const col of gateCols) {
    numWires = Math.max(numWires, col.minimumRequiredWireCount());
  }
  numWires = Math.max(
    Simulation.MIN_WIRE_COUNT,
    Math.min(numWires, Simulation.MAX_WIRE_COUNT),
    registers.minimumRequiredWireCount(),
    ...[...initialValues.keys()].map((e) => e + 1),
  );

  // Pad or truncate each column to the displayed wire count in one allocation.
  gateCols = gateCols.map(col =>
    new GateColumn(Array.from({ length: numWires }, (_, row) => col.gates[row])),
  );

  return new CircuitDefinition(
    numWires,
    gateCols,
    undefined,
    undefined,
    customGateSet,
    false,
    initialValues,
    registers,
  ).withTrailingSpacersIncluded();
}

export { toJson_CircuitDefinition, fromJson_CircuitDefinition };
