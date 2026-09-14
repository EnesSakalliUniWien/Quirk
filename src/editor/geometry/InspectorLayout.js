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
        Layout.GATE_RADIUS * 2 + Layout.COLUMN_SPACING * (gate.width - 1),
        Layout.GATE_RADIUS * 2 + Layout.WIRE_SPACING * (gate.height - 1));
    return gate.serializedId === 'Bloch' ? CircuitGeometry.blochDisplayRect(rect) : rect;
}

/** Height of the circuit band and its symmetric minimum margins. */
export function inspectorDesiredHeight(circuit) {
    return circuit.desiredHeight() + 2 * Layout.CIRCUIT_TOP_MARGIN;
}
