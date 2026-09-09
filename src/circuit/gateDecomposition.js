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

import {CircuitDefinition} from "./model/CircuitDefinition.js"
import {GateColumn} from "./model/GateColumn.js"
import {Controls} from "../gates/probes/Controls.js"
import {HalfTurnGates} from "../gates/rotations/HalfTurnGates.js"

/**
 * The gates a built-in gate stands for.
 *
 * Most gates here are simulated by a shader: the increment gate adds one to a register in one pass,
 * it does not run a ladder of controlled NOTs. That is the right way to simulate it and the wrong
 * way to explain it, so this file writes down the circuit each one is equivalent to, purely to be
 * shown.
 *
 * Nothing here feeds the simulator. A decomposition being wrong would therefore be silent, which is
 * why test/circuit/gateDecomposition.test.js multiplies each one out and compares it against the
 * gate's own matrix.
 */

/**
 * Adding one to a little-endian register: flip the top bit when every bit below it is set, then the
 * next, and so on down to the bottom bit, which always flips.
 *
 * @param {!int} span How many wires the register covers.
 * @param {!boolean} up True to increment, false to decrement.
 * @returns {!CircuitDefinition}
 */
function offsetCircuit(span, up) {
    const columns = [];
    // Incrementing carries upward, so the most-controlled flip comes first; decrementing is the
    // same ladder in reverse, which is why the two gates are each other's inverse.
    const targets = up ?
        Array.from({length: span}, (_, i) => span - 1 - i) :
        Array.from({length: span}, (_, i) => i);
    for (const target of targets) {
        const gates = Array.from({length: span}, (_, row) =>
            row === target ? HalfTurnGates.X :
            row < target ? Controls.Control :
            undefined);
        columns.push(new GateColumn(gates));
    }
    return new CircuitDefinition(span, columns);
}

/**
 * Every decomposition worth showing, by the prefix of the serialized ids it covers. A family's
 * members are `inc2`, `inc3` and so on, so the span comes from the gate rather than the key.
 *
 * @type {!Array.<!{matches: !function(!string): !boolean,
 *     circuit: !function(!int): !CircuitDefinition}>}
 */
const DECOMPOSITIONS = [
    {matches: id => /^inc\d+$/.test(id), circuit: span => offsetCircuit(span, true)},
    {matches: id => /^dec\d+$/.test(id), circuit: span => offsetCircuit(span, false)},
];

/**
 * The circuit a gate stands for, if the app knows one.
 *
 * A gate built from a circuit already carries it; this adds the ones whose circuit is known but
 * never built, because the simulator reaches their effect another way.
 *
 * @param {!Gate} gate
 * @returns {undefined|!CircuitDefinition}
 */
function decompositionOf(gate) {
    if (gate.knownCircuitNested !== undefined) {
        return gate.knownCircuitNested;
    }
    const known = DECOMPOSITIONS.find(entry => entry.matches(gate.serializedId));
    return known === undefined ? undefined : known.circuit(gate.height);
}

export {decompositionOf}
