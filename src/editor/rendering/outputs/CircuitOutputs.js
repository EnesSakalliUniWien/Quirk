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

import {paintProbabilityBox} from '../../../draw/displays/ProbabilityView.js';
import {frame} from '../../../draw/shapes/ShapeView.js';
import {CircuitGeometry} from '../../geometry/CircuitGeometry.js';
import {paintBlochSphereDisplay} from '../../../gates/displays/BlochSphereDisplay.js';
import {drawOutputSuperpositionDisplay} from './CircuitAmplitudes.js';
import {drawLocalStateCaption} from './CircuitCaptions.js';

/**
 * Draws a peek gate on each wire at the right-hand side of the circuit.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!CircuitStats} stats
 * @param {!PointerInteractionState} hand
 */
function drawOutputDisplays(context, painter, stats, hand) {
    const chanceCol = context.geometry.clampedCircuitColCount() + 1;
    const blochCol = chanceCol + 1;
    const numWire = context.geometry.importantWireCount();

    for (let i = 0; i < numWire; i++) {
        const p = stats.controlledWireProbabilityJustAfter(i, Infinity);
        painter.group('probability-' + i, view => paintProbabilityBox(view, p, context.geometry.gateRect(i, chanceCol), hand.hoverPoints()));
        const m = stats.qubitDensityMatrix(Infinity, i);
        if (m !== undefined) {
            const blochRect = CircuitGeometry.blochDisplayRect(context.geometry.gateRect(i, blochCol));
            painter.group('bloch-' + i, view => {
                paintBlochSphereDisplay(view, m, blochRect, hand.hoverPoints());
                frame(view, blochRect);
            });
        }
    }

    drawLocalStateCaption(context, painter, numWire, chanceCol);

    painter.group('amplitudes', view => drawOutputSuperpositionDisplay(context, view, stats, hand));
}

export {drawOutputDisplays};
