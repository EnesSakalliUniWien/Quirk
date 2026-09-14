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

import {CircuitGeometry} from './CircuitGeometry.js';

const geometries = new WeakMap();

/** Derives layout once per immutable display snapshot, without modifying that snapshot. */
export function geometryForCircuit(circuit) {
    let geometry = geometries.get(circuit);
    if (geometry === undefined) {
        const unshifted = new CircuitGeometry(circuit.top, circuit.circuitDefinition,
            circuit._compressedColumnIndex, circuit._extraWireStartIndex, 0);
        const shift = Math.max(0, circuit._availableWidth - unshifted.desiredWidth());
        geometry = shift === 0 ? unshifted : new CircuitGeometry(circuit.top, circuit.circuitDefinition,
            circuit._compressedColumnIndex, circuit._extraWireStartIndex, shift);
        Object.freeze(geometry);
        geometries.set(circuit, geometry);
    }
    return geometry;
}
