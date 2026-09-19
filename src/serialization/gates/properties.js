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

import { describe } from "../../base/Describe.js";

/**
 * @param {*} json
 * @returns {!String}
 * @private
 */
function _getGateId(json) {
  const symbol = typeof json === "string" ? json : json["id"];

  // Recover from bad symbol.
  if (symbol === undefined) {
    return "";
  }
  if (typeof symbol !== "string") {
    return describe(symbol);
  }

  return symbol;
}

/**
 * @param {object} json
 * @returns {!{id: !String, matrix: *, circuit: *, symbol: *, name: *, param: *, off: !boolean}}
 */
function fromJson_Gate_props(json) {
  const id = _getGateId(json);
  const matrix = json["matrix"];
  const circuit = json["circuit"];
  const param = json["arg"];
  const off = json["off"] === true;
  const symbol =
    json.name !== undefined ? json.name : id.startsWith("~") ? "" : id;
  const name = id.startsWith("~")
    ? `${symbol || "Custom"} Gate [${id.slice(1)}]`
    : symbol !== ""
      ? symbol
      : id;
  return { id, matrix, circuit, symbol, name, param, off };
}

export { fromJson_Gate_props };
