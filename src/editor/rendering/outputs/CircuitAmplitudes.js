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

import { paintMatrixTooltip } from "../../../draw/tooltips/MatrixTooltip.js";
import { paintMatrix } from "../../../draw/displays/complex/MatrixView.js";
import { formatProbability } from "../../../draw/displays/probability/ProbabilityScale.js";
import { frame } from "../../../draw/shapes/ShapeView.js";
import { CanvasTheme } from "../../../config/CanvasTheme.js";
import { Format, signedFixed } from "../../../base/Format.js";
import { ketLabel } from "../../../circuit/registerLabels.js";
import { Matrix } from "../../../engine/math/matrix/Matrix.js";
import {
  phaseReferenceIndex,
  withPhaseReference,
} from "../../../engine/math/phaseReference.js";
import { drawOutputSuperpositionDisplay_labels } from "./CircuitBasisLabels.js";

/**
 * The output grid's amplitudes as it draws them: every phase measured from the reference amplitude,
 * the largest, which therefore points at 0°. Only the phases between amplitudes can be measured, so
 * this is the same state; it is drawn the way the Amps gates draw theirs.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @returns {!{grid: !Matrix, reference: (undefined|!int)}}
 */
function referencedOutputGrid(context) {
  const raw = context.outputStateAsMatrix();
  const reference = raw.hasNaN()
    ? undefined
    : phaseReferenceIndex(raw.rawBuffer());
  const grid =
    reference === undefined
      ? raw
      : new Matrix(
          raw.width(),
          raw.height(),
          withPhaseReference(raw.rawBuffer(), reference),
        );
  return { grid, reference };
}

/**
 * Updates the amplitude grid, basis labels and amplitude tooltips.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!CircuitStats} stats
 * @param {!PointerInteractionState} hand
 */
function drawOutputSuperpositionDisplay(context, painter, stats, hand) {
  const { grid: amplitudeGrid, reference } = referencedOutputGrid(context);
  const gridRect = context.geometry.rectForSuperpositionDisplay();

  const numWire = context.geometry.importantWireCount();
  // Past the size where discs read, paintMatrix draws the grid as pixels on its own.
  paintMatrix(painter, amplitudeGrid, gridRect, {
    wireCount: numWire,
    showChance: true,
    chanceLabels: true,
  });
  frame(painter, gridRect, CanvasTheme.stroke.displayFrame);
  const registers = context.definition.registers.fittingIn(numWire);
  const ket = (index) => `|${ketLabel(registers, numWire, index)}⟩`;
  // The chance first, the number a reader came for; then the phase, said from where it is measured.
  paintMatrixTooltip(
    painter,
    amplitudeGrid,
    gridRect,
    hand.hoverPoints(),
    (c, r) =>
      `${ket(r * amplitudeGrid.width() + c)} (decimal ${r * amplitudeGrid.width() + c})`,
    (c, r, v) =>
      `${formatProbability(v.norm2(), 2)} probability · phase ${signedFixed((v.phase() * 180) / Math.PI, 2)}°`,
    (c, r, v) =>
      `amplitude ${v.toString(Format.SIMPLIFIED)}` +
      (reference === undefined ? "" : `, phases from ${ket(reference)}`),
  );

  drawOutputSuperpositionDisplay_labels(context, painter);
}

export { drawOutputSuperpositionDisplay, referencedOutputGrid };
