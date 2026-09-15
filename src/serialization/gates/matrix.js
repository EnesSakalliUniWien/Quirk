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

import { Util } from "../../base/Util.js";
import { GateBuilder } from "../../circuit/model/Gate.js";
import { MysteryGateSymbol, MysteryGateMakerWithMatrix } from "../../gates/misc/Joke_MysteryGate.js";
import { MATRIX_RENDERER, LABEL_RENDERER, LOCATION_INDEPENDENT_GATE_RENDERER } from "../../draw/gate/GateRenderers.js";
import { fromJson_Matrix } from "../numeric/values.js";

/**
 * @param {*} matrixProp
 * @returns {!Matrix}
 * @private
 * @throws
 */
function _parseGateMatrix(matrixProp) {
  if (matrixProp === undefined) {
    throw new Error("Unrecognized gate id, but no matrix specified.");
  }
  const matrix = fromJson_Matrix(matrixProp);
  if (matrix.width() !== matrix.height()) {
    throw new Error("Gate matrix must be square.");
  }
  if (
    matrix.width() < 2 ||
    matrix.width() > 1 << 4 ||
    !Util.isPowerOf2(matrix.width())
  ) {
    throw new Error("Supported gate matrix sizes are 2, 4, 8, and 16.");
  }
  return matrix;
}

/**
 * @param {!{id: !String, matrix: *, circuit: *, symbol: *, name: *, param: *}} props
 * @returns {!Gate}
 */
function fromJson_Gate_Matrix(props) {
  const matrix = _parseGateMatrix(props.matrix);

  // Special case the mystery gate.
  if (props.id === MysteryGateSymbol) {
    return MysteryGateMakerWithMatrix(matrix);
  }

  const height = Math.round(Math.log2(matrix.height()));
  const width = props.symbol === "" ? height : 1;

  const builder = new GateBuilder()
    .setSerializedId(props.id)
    .setSymbol(props.symbol)
    .setTitle(props.name)
    .setHeight(height)
    .setWidth(width)
    .setRenderer(
      props.symbol === ""
        ? MATRIX_RENDERER
        : matrix.isIdentity()
          ? LABEL_RENDERER
          : matrix.isScaler()
            ? LOCATION_INDEPENDENT_GATE_RENDERER
            : undefined,
    )
    .setKnownEffectToMatrix(matrix);
  if (matrix.isIdentity()) {
    builder.markAsNotInterestedInControls();
  }
  return builder.gate;
}

export { fromJson_Gate_Matrix };
