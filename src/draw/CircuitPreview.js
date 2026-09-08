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
 * Paints a circuit into a rect, scaled to fit, and reports the size it took. The renderer is
 * the editor's DisplayedCircuit (src/editor/DisplayedCircuit.js), whose modules import this
 * layer, so the editor deposits it here at load time instead of this layer importing it -
 * the same seam as gate/CustomGateCircuitDrawer.js.
 *
 * Until it is deposited, the preview area is reported at its full size and left empty.
 *
 * @type {undefined|!function(!DisplayView, !CircuitDefinition, !Rect, !boolean, !number):
 *     !{maxW: !number, maxH: !number}}
 */
let _painter = undefined;

/**
 * @param {!function(!DisplayView, !CircuitDefinition, !Rect, !boolean, !number):
 *     !{maxW: !number, maxH: !number}} painter
 * @returns {void}
 */
function setCircuitPreviewPainter(painter) {
  _painter = painter;
}

/**
 * @param {!DisplayView} painter
 * @param {!CircuitDefinition} circuit
 * @param {!Rect} rect
 * @param {!boolean} showWires
 * @param {!number} time
 * @returns {!{maxW: !number, maxH: !number}}
 */
function paintCircuitPreview(painter, circuit, rect, showWires, time) {
  if (_painter === undefined) {
    return { maxW: rect.w, maxH: rect.h };
  }
  return _painter(painter, circuit, rect, showWires, time);
}

export { setCircuitPreviewPainter, paintCircuitPreview };
