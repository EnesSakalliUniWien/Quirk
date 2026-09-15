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
import { GateBuilder } from "../../circuit/model/Gate.js";
import { Gates } from "../../gates/AllGates.js";
import { describe } from "../../base/Describe.js";
import { DetailedError } from "../../base/DetailedError.js";
import { reportRecoveredError } from "../../diagnostics/errorReporter.js";
import { setGateBuilderEffectToCircuit } from "../../engine/simulation/CircuitComputeUtil.js";
import { renderCustomGateCircuit } from "../../draw/gate/CustomGateCircuitRenderer.js";
import { toJson_Matrix } from "../numeric/values.js";
import { fromJson_Gate_props } from "./properties.js";
import { fromJson_Gate_Matrix } from "./matrix.js";
import { toJson_CircuitDefinition, fromJson_CircuitDefinition } from "../circuits/circuit.js";

// Gates may contain circuits, and circuits contain gates. These imports are only
// called from functions after initialization; no registration or global mutation is needed.

/**
 * @param {!Gate} gate
 * @param {!CustomGateSet=} context
 * @returns {!object}
 */
function toJson_Gate(gate, context = new CustomGateSet()) {
  const found = Gates.findKnownGateById(gate.serializedId, context);
  if (found === gate) {
    return gate.serializedId;
  }
  if (found !== undefined && found.param !== undefined) {
    return { id: gate.serializedId, arg: gate.param };
  }

  if (gate.name === "Parse Error") {
    return gate.tag;
  }

  const result = {};
  if (gate.serializedId !== "") {
    result.id = gate.serializedId;
  }
  if (
    gate.serializedId.startsWith("~")
      ? gate.symbol !== ""
      : gate.symbol !== gate.serializedId
  ) {
    result.name = gate.symbol;
  }

  if (
    gate.stableDuration() === Infinity &&
    gate.knownMatrixAt(0) !== undefined
  ) {
    result.matrix = toJson_Matrix(gate.knownMatrixAt(0.25));
  } else if (gate.knownCircuit !== undefined) {
    result.circuit = toJson_CircuitDefinition(gate.knownCircuit, context);
  } else {
    throw new DetailedError("Don't known how to serialize gate's function.", {
      gate,
    });
  }

  return result;
}

/**
 * @param {!{id: !String, matrix: *, circuit: *, symbol: *, name: *, param: *}} props
 * @param {undefined|!CustomGateSet} context
 * @returns {!Gate}
 */
function fromJson_Gate_Circuit(props, context) {
  const circuit = fromJson_CircuitDefinition(
    props.circuit,
    context,
  ).withMinimumWireCount();
  return setGateBuilderEffectToCircuit(new GateBuilder(), circuit)
    .setSerializedId(props.id)
    .setSymbol(props.symbol)
    .setTitle(props.name)
    .setRenderer(renderCustomGateCircuit).gate;
}

/**
 * @param {!object} json
 * @param {!CustomGateSet=} context
 * @returns {!Gate}
 * @throws {Error}
 */
function fromJson_Gate(json, context = new CustomGateSet()) {
  const props = fromJson_Gate_props(json);

  try {
    if (props.matrix !== undefined) {
      return fromJson_Gate_Matrix(props);
    }

    if (props.circuit !== undefined) {
      return fromJson_Gate_Circuit(props, context);
    }

    // Operation not provided. Try to match by id.
    let match = Gates.findKnownGateById(props.id, context);
    if (match === undefined) {
      throw new DetailedError(`No gate with the id '${props.id}'.`, { json });
    }
    if (props.param !== undefined) {
      if (match.param === undefined) {
        throw new DetailedError("Arg for gate without arg.", { json });
      }
      match = match.withParam(props.param);
    }
    return match;
  } catch (ex) {
    reportRecoveredError(
      "Defaulted to a do-nothing 'parse error' gate. Failed to understand the json defining a gate.",
      { gate_json: json },
      ex,
    );
    return new GateBuilder()
      .setSerializedIdAndSymbol(props.id)
      .setTitle("Parse Error")
      .setBlurb(describe(ex))
      .promiseHasNoNetEffectOnStateVector()
      .setExtraDisableReasonFinder(() => "parse\nerror")
      .setTag(json).gate;
  }
}

export { toJson_Gate, fromJson_Gate };
