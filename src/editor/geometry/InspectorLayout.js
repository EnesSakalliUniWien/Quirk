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

import {Layout} from '../../config/Layout.js';
import {Rect} from '../../geometry/Rect.js';
import {CircuitGeometry} from './CircuitGeometry.js';

/** Center the circuit band, with a minimum top margin. */
export function circuitInArea(circuit, area) {
    const top = Math.max(Layout.CIRCUIT_TOP_MARGIN, Math.floor((area.h - circuit.desiredHeight()) / 2));
    return circuit.withLayout(top, area.w);
}

/** Held gates follow the circuit's spacing and Bloch display bounds. */
export function heldGateRect(hand) {
    const gate = hand.heldGate;
    const pos = hand.pos.minus(hand.holdOffset);
    const rect = new Rect(
        Math.round(pos.x - 0.5) + 0.5, Math.round(pos.y - 0.5) + 0.5,
        Layout.GATE_RADIUS * 2 + Layout.COLUMN_SPACING * (CircuitGeometry.drawnWidth(gate) - 1),
        Layout.GATE_RADIUS * 2 + Layout.WIRE_SPACING * (gate.height - 1));
    return gate.serializedId === 'Bloch' ? CircuitGeometry.blochDisplayRect(rect) : rect;
}

/** Height of the circuit band and its symmetric minimum margins. */
export function inspectorDesiredHeight(circuit) {
    return circuit.desiredHeight() + 2 * Layout.CIRCUIT_TOP_MARGIN;
}
