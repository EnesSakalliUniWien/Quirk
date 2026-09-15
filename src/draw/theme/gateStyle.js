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
  const p = CanvasTheme.iqp;
  let fill;
  if (id === "H") fill = p.hadamard;
  else if (id === "X" || id === "Swap") fill = p.not;
  else if (id === "Measure") fill = p.measure;
  else if (/^(Z($|\^)|Rz($|ft$)|e\^[-+]?iZt$)/.test(id)) fill = p.phase;
  else if (/^(Y$|[XY]\^|R[xy]($|ft$)|e\^[-+]?i[XY]t$)/.test(id))
    fill = p.rotation;
  return {
    fill: fill || CanvasTheme.surface.gate,
    text: fill ? CanvasTheme.text.onBright : CanvasTheme.text.primary,
  };
}


export {gateStyle};
