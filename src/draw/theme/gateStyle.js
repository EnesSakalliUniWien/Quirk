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

import {CanvasTheme} from './CanvasTheme.js';

function gateStyle(gate) {
  const id = gate.serializedId || "";
  // The IQP family, which names both the fill and the label drawn on it.
  let family;
  if (id === "H") family = "hadamard";
  else if (id === "X" || id === "Swap") family = "not";
  else if (id === "Measure") family = "measure";
  else if (/^(Z($|\^)|Rz($|ft$)|e\^[-+]?iZt$)/.test(id)) family = "phase";
  else if (/^(Y$|[XY]\^|R[xy]($|ft$)|e\^[-+]?i[XY]t$)/.test(id))
    family = "rotation";
  if (family === undefined) {
    return {fill: CanvasTheme.surface.gate, text: CanvasTheme.text.primary};
  }
  return {fill: CanvasTheme.iqp[family], text: CanvasTheme.iqpText[family]};
}


export {gateStyle};
