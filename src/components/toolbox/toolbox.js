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

/**
 * @param {!Gate} gate
 * @returns {!string} The name a toolbox row shows.
 */
function listNameOf(gate) {
  return gate.listName || gate.name || gate.symbol || gate.serializedId;
}

/**
 * Splits a gate's symbol into its base and exponent, so the chip can typeset the exponent as a
 * real superscript instead of caret markup.
 *
 * @param {!Gate} gate
 * @returns {!{base: !string, sup: !string}}
 */
function chipPartsOf(gate) {
  const text = gate.symbol !== "" ? gate.symbol : listNameOf(gate).charAt(0);
  const caret = text.indexOf("^");
  if (caret <= 0 || caret === text.length - 1) {
    return { base: text, sup: "" };
  }
  return { base: text.slice(0, caret), sup: text.slice(caret + 1) };
}

/**
 * @param {!Gate} gate
 * @param {!string} groupHint
 * @returns {!string} The text the search box matches against.
 */
function searchTextOf(gate, groupHint) {
  return `${gate.name} ${gate.listName} ${gate.symbol} ${gate.serializedId} ${groupHint}`.toLowerCase();
}

export { chipPartsOf, listNameOf, searchTextOf };
