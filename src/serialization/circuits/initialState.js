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

import { INITIAL_STATE_KEYS } from "../../circuit/model/InitialStates.js";
import { DetailedError } from "../../base/DetailedError.js";

/** Keep the existing sparse initial-state encoding; omitted wires start in zero. */
function toJson_InitialState(initialValues) {
  const result = [];
  const maxInit = Math.max(...initialValues.keys());
  for (let i = 0; i <= maxInit; i++) {
    const value = initialValues.get(i);
    result.push(value === undefined ? 0 : value === "1" ? 1 : value);
  }
  return result;
}

/**
 * @param {object} json
 * @returns {!Map.<!int, !string>}
 * @throws
 */
function _fromJson_InitialState(json) {
  const { init } = json;
  if (init === undefined) {
    return new Map();
  }

  if (!Array.isArray(init)) {
    throw new DetailedError("Initial states must be an array.", { json });
  }

  const result = new Map();
  for (let i = 0; i < init.length; i++) {
    const v = init[i];
    if (v === 0) {
      // 0 is the default. Don't need to do anything.
    } else if (v === 1) {
      result.set(i, "1");
    } else if (INITIAL_STATE_KEYS.includes(v)) {
      result.set(i, v);
    } else {
      throw new DetailedError("Unrecognized initial state key.", { v, json });
    }
  }

  return result;
}

export { toJson_InitialState, _fromJson_InitialState };
