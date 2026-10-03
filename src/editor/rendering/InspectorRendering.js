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

import {renderCircuitTargets} from '../interaction/CircuitTargets.js';
import {paintCircuit} from './CircuitRendering.js';
import {rectangle} from '../../draw/shapes/ShapeView.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {GateRenderParams} from '../../draw/gate/GateRenderParams.js';
import {DEFAULT_RENDERER} from '../../draw/gate/GateRenderers.js';
import {heldGateRect} from '../geometry/InspectorLayout.js';

/**
 * Compose the background, circuit and held gate from snapshot inputs. `range`, as {left, right} in
 * circuit units, is the stretch of the circuit to describe, columns and their hit areas alike.
 */
export function renderInspector({drawArea, displayedCircuit, hand}, view, stats, playheadStep, breakpoints = [], selection = undefined, follow = undefined, scrollX = 0, range = undefined) {
    rectangle(view, drawArea, {fill: CanvasTheme.surface.background});
    view.group('circuit', child => paintCircuit(displayedCircuit, child, hand, stats, false, true, playheadStep, breakpoints, selection, follow, scrollX, range));
    // The gate riding the cursor takes no pointer: the press lands on what lies under it.
    view.group('held-gates', child => {
        if (hand.pos === undefined || hand.heldGate === undefined) return;
        const gate = hand.heldGate;
        const renderer = gate.customRenderer || DEFAULT_RENDERER;
        renderer(GateRenderParams.held(child, hand, heldGateRect(hand), gate, stats));
    }, {pointer: false});
    view.group('interaction', child => renderCircuitTargets(child, {definition: displayedCircuit.circuitDefinition, geometry: displayedCircuit.geometry()}, hand, range));
}
