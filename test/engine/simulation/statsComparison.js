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

import { Matrix } from "../../../src/engine/math/matrix/Matrix.js";

/**
 * Whether two results hold the same numbers, to the last bit. NaN is the same as NaN, which results
 * hold wherever a display has nothing to show.
 *
 * @param {*} actual
 * @param {*} expected
 * @param {!number=} tolerance Numbers this far apart are the same. Exact by default.
 * @returns {!boolean}
 */
function sameData(actual, expected, tolerance = 0) {
  if (actual instanceof Matrix) {
    return (
      expected instanceof Matrix &&
      actual.width() === expected.width() &&
      actual.height() === expected.height() &&
      sameData(actual.rawBuffer(), expected.rawBuffer(), tolerance)
    );
  }
  if (actual !== null && typeof actual === "object") {
    if (expected === null || typeof expected !== "object") {
      return false;
    }
    if (actual instanceof Map) {
      return (
        expected instanceof Map &&
        sameData([...actual], [...expected], tolerance)
      );
    }
    if (Array.isArray(actual) || ArrayBuffer.isView(actual)) {
      return (
        actual.length === expected.length &&
        Array.prototype.every.call(actual, (e, i) =>
          sameData(e, expected[i], tolerance),
        )
      );
    }
    const keys = Object.keys(actual);
    return (
      keys.length === Object.keys(expected).length &&
      keys.every((key) => sameData(actual[key], expected[key], tolerance))
    );
  }
  return (
    actual === expected ||
    (Number.isNaN(actual) && Number.isNaN(expected)) ||
    (typeof actual === "number" &&
      typeof expected === "number" &&
      Math.abs(actual - expected) <= tolerance)
  );
}

/**
 * Says where two CircuitStats differ, looking at everything they hold for the circuit's columns.
 *
 * @param {!CircuitStats} actual
 * @param {!CircuitStats} expected
 * @param {!number=} tolerance
 * @returns {undefined|!string} What differs first, or undefined if nothing does.
 */
function statsDifference(actual, expected, tolerance = 0) {
  const circuit = expected.circuitDefinition;
  if (!actual.circuitDefinition.isEqualTo(circuit)) {
    return "circuit";
  }
  if (actual.time !== expected.time || actual.seed !== expected.seed) {
    return "time or seed";
  }
  if (!sameData(actual.finalState, expected.finalState, tolerance)) {
    return "final state";
  }
  for (let col = -1; col <= circuit.columns.length + 1; col++) {
    if (
      !sameData(actual.survivalRate(col), expected.survivalRate(col), tolerance)
    ) {
      return `survival rate at column ${col}`;
    }
  }
  for (let col = 0; col <= circuit.columns.length; col++) {
    for (let wire = 0; wire < circuit.numWires; wire++) {
      if (
        !sameData(
          actual.qubitDensityMatrix(col, wire),
          expected.qubitDensityMatrix(col, wire),
          tolerance,
        )
      ) {
        return `qubit density at column ${col}, wire ${wire}`;
      }
    }
  }
  if (
    !sameData(
      [...actual.customStatsEntries()],
      [...expected.customStatsEntries()],
      tolerance,
    )
  ) {
    return "custom stats";
  }
  if (!sameData(actual.sampleOutcomes, expected.sampleOutcomes, tolerance)) {
    return "sample outcomes";
  }
  return undefined;
}

export { sameData, statsDifference };
