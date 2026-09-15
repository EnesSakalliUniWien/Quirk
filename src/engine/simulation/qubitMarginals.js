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

import {Complex} from "../math/complex/Complex.js"
import {Matrix} from "../math/matrix/Matrix.js"
import {blochCoordinates} from "../math/bloch.js"

/**
 * What each qubit looks like on its own: the state with every other qubit traced out.
 *
 * The simulator only reports a single qubit's density matrix where a Bloch display sits, so this
 * derives it from the full state instead. For qubit q it sums, over every setting of the other
 * qubits, the pair of amplitudes that differ only in q - O(n·2^n), fine for the sizes a state
 * table shows.
 *
 * Purity is 1 for a qubit in a definite state of its own and 1/2 for one maximally entangled with
 * the rest; for a circuit with no measurement or post-selection, anything below 1 is entanglement.
 *
 * @param {!Matrix} state A column vector over `wireCount` qubits, as paddedState returns.
 * @param {!int} wireCount
 * @param {!int=} measuredMask Deferred measurements at this step, from colIsMeasuredMask.
 * @returns {!Array.<!{wire: !int, probabilityOne: !number, bloch: !{x: !number, y: !number, z: !number},
 *     purity: !number}>}
 */
function qubitMarginals(state, wireCount, measuredMask = 0) {
    const buf = state.rawBuffer();
    const size = 1 << wireCount;
    const marginals = [];
    for (let wire = 0; wire < wireCount; wire++) {
        const bit = 1 << wire;
        let p0 = 0, p1 = 0, cr = 0, ci = 0;
        for (let i = 0; i < size; i++) {
            if ((i & bit) !== 0) {
                continue;
            }
            const ar = buf[i * 2], ai = buf[i * 2 + 1];
            const br = buf[(i | bit) * 2], bi = buf[(i | bit) * 2 + 1];
            p0 += ar * ar + ai * ai;
            p1 += br * br + bi * bi;
            // The simulator's single-qubit density matrices hold conj(a) * b in the off-diagonal
            // corner, and blochCoordinates reads that layout; matching it keeps this panel and
            // the circuit's Bloch displays pointing the same way.
            cr += ar * br + ai * bi;
            ci += ar * bi - ai * br;
        }
        // Post-selection can leave less than a whole state; read the qubit relative to what is left.
        const norm = p0 + p1;
        const scale = norm > 1e-12 ? 1 / norm : 0;
        // Deferred measurement leaves the simulation amplitudes coherent; the physical density
        // matrix loses its off-diagonal entries on measured wires.
        const coherence = (measuredMask & bit) === 0 ? scale : 0;
        const rho00 = p0 * scale, rho11 = p1 * scale, rho01r = cr * coherence, rho01i = ci * coherence;
        const density = Matrix.square(
            new Complex(rho00, 0), new Complex(rho01r, rho01i),
            new Complex(rho01r, -rho01i), new Complex(rho11, 0));
        marginals.push({
            wire,
            probabilityOne: rho11,
            bloch: blochCoordinates(density),
            purity: rho00 * rho00 + rho11 * rho11 + 2 * (rho01r * rho01r + rho01i * rho01i),
        });
    }
    return marginals;
}

function qubitReadings(stats, wireCount) {
    return Array.from({length: wireCount}, (_, wire) => {
        const density = stats.qubitDensityMatrix(Infinity, wire);
        const bloch = blochCoordinates(density);
        return {wire, bloch, probabilityOne: (1 - bloch.z) / 2,
            purity: (1 + bloch.x ** 2 + bloch.y ** 2 + bloch.z ** 2) / 2};
    });
}

export {qubitMarginals, qubitReadings}
