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

import {paintMatrixTooltip} from '../../../draw/tooltips/MatrixTooltip.js';
import {paintMatrix} from '../../../draw/displays/MatrixView.js';
import {frame} from '../../../draw/shapes/ShapeView.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Rendering} from '../../../config/Rendering.js';
import {Format} from '../../../base/Format.js';
import {ketLabel} from '../../../circuit/registerLabels.js';
import {drawOutputSuperpositionDisplay_labels} from './CircuitBasisLabels.js';

/**
 * Updates the amplitude grid, basis labels and amplitude tooltips.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!CircuitStats} stats
 * @param {!PointerInteractionState} hand
 */
function drawOutputSuperpositionDisplay(context, painter, stats, hand) {
    const amplitudeGrid = context.outputStateAsMatrix();
    const gridRect = context.geometry.rectForSuperpositionDisplay();

    const numWire = context.geometry.importantWireCount();
    paintMatrix(painter, amplitudeGrid, gridRect, {
        amplitudeCircleFillColor: numWire < Rendering.SIMPLE_SUPERPOSITION_DRAWING_WIRE_THRESHOLD ? CanvasTheme.amplitude.circle : undefined,
        amplitudeCircleStrokeColor: CanvasTheme.text.primary,
        amplitudeProbabilityFillColor: numWire < Rendering.SIMPLE_SUPERPOSITION_DRAWING_WIRE_THRESHOLD ? CanvasTheme.amplitude.fill : undefined,
        backColor: CanvasTheme.amplitude.background
    });
    frame(painter, gridRect);
    const forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    paintMatrixTooltip(painter, amplitudeGrid, gridRect, hand.hoverPoints(),
        (c, r) => `Amplitude of |${ketLabel(context.definition.registers.fittingIn(numWire), numWire,
            r*amplitudeGrid.width() + c)}⟩ (decimal ${r*amplitudeGrid.width() + c})`,
        (c, r, v) => 'val:' + v.toString(Format.SIMPLIFIED),
        (c, r, v) => `mag²:${(v.norm2()*100).toFixed(4)}%, phase:${forceSign(v.phase() * 180 / Math.PI)}°`);

    drawOutputSuperpositionDisplay_labels(context, painter);
}

export {drawOutputSuperpositionDisplay};
