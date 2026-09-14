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

import {outputStateAsMatrix} from './outputs/CircuitOutputState.js';
import {renderCircuitLayers} from './CircuitLayers.js';

export {invalidateCircuitLabelCache} from './outputs/CircuitBasisLabels.js';

/** Adapts the public circuit API to explicit scene inputs. Rendering only updates Pixi objects. */
export function paintCircuit(circuit, painter, hand, stats, forTooltip=false, showWires=true, playheadStep=undefined) {
    const geometry = circuit.geometry();
    const context = {
        definition: circuit.circuitDefinition,
        geometry,
        highlightedSlot: circuit.highlightedSlot,
        highlightStatusAt: (col, row, points) => circuit.highlightStatusAt(col, row, points),
        outputStateAsMatrix: () => outputStateAsMatrix(stats, geometry.importantWireCount())
    };
    renderCircuitLayers(context, painter, hand, stats, forTooltip, showWires, playheadStep);
}
