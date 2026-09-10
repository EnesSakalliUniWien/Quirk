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

import { Complex } from "../../engine/math/complex/Complex.js";
import { GateBuilder } from "../../circuit/model/Gate.js";
import { GatePainting } from "../../draw/gate/GatePainting.js";
import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { MatrixDecomposition } from "../../engine/math/matrix/MatrixDecomposition.js";

const MysteryGateSymbol = "?";

const MysteryGateMakerWithMatrix = (matrix) =>
  new GateBuilder()
    .setSerializedIdAndSymbol(MysteryGateSymbol)
    .setTitle("Mystery Gate")
    .setBlurb("Different every time.\n(Use shift+drag to copy circuit gates.)")
    .setRenderer(GatePainting.MATRIX_RENDERER)
    .setKnownEffectToMatrix(matrix).gate;

const MysteryGateMaker = () =>
  MysteryGateMakerWithMatrix(
    MatrixDecomposition.closestUnitary(Matrix.square(
      new Complex(Math.random() - 0.5, Math.random() - 0.5),
      new Complex(Math.random() - 0.5, Math.random() - 0.5),
      new Complex(Math.random() - 0.5, Math.random() - 0.5),
      new Complex(Math.random() - 0.5, Math.random() - 0.5),
    ), 0.00001),
  );

export { MysteryGateSymbol, MysteryGateMaker, MysteryGateMakerWithMatrix };
