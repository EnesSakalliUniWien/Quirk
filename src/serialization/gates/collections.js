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

import { CustomGateSet } from "../../circuit/model/CustomGateSet.js";
import { GateColumn } from "../../circuit/model/GateColumn.js";
import { describe } from "../../base/Describe.js";
import { DetailedError } from "../../base/DetailedError.js";
import { toJson_Gate, fromJson_Gate } from "./gate.js";

/**
 * @param {!GateColumn} v
 * @param {!CustomGateSet=} context
 * @returns {!object}
 */
function toJson_GateColumn(v, context = new CustomGateSet()) {
  return v.gates.map((e) => (e === undefined ? 1 : toJson_Gate(e, context)));
}

/**
 * @param {object} json
 * @param {!CustomGateSet=} context
 * @returns {!GateColumn}
 * @throws
 */
function fromJson_GateColumn(json, context = new CustomGateSet()) {
  if (!Array.isArray(json)) {
    throw new Error(
      `GateColumn json should be an array. Json: ${describe(json)}`,
    );
  }
  return new GateColumn(
    json.map((e) =>
      e === 1 || e === undefined ? undefined : fromJson_Gate(e, context),
    ),
  );
}

/**
 * @param {!CustomGateSet} v
 * @returns {*}
 */
function toJson_CustomGateSet(v) {
  const result = [];
  for (let i = 0; i < v.gates.length; i++) {
    result.push(
      toJson_Gate(v.gates[i], new CustomGateSet(...v.gates.slice(0, i))),
    );
  }
  return result;
}

/**
 * @param {*} json
 * @returns {!CustomGateSet}
 */
function fromJson_CustomGateSet(json) {
  if (!Array.isArray(json)) {
    throw new DetailedError("Expected an array of gates.", { json });
  }
  let gatesSoFar = new CustomGateSet();
  for (const e of json) {
    gatesSoFar = gatesSoFar.withGate(fromJson_Gate(e, gatesSoFar));
  }
  return gatesSoFar;
}

export { toJson_GateColumn, fromJson_GateColumn, toJson_CustomGateSet, fromJson_CustomGateSet };
