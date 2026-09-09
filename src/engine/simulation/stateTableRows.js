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

import {Util} from "../../base/Util.js"

/**
 * Amplitudes at or below this probability are treated as absent. NaN amplitudes fail the same
 * comparison, so a circuit that failed to simulate reports nothing rather than a screen of NaN.
 * @type {!number}
 */
const NEGLIGIBLE_PROBABILITY = 1e-12;

/**
 * The most rows the table draws. Sixteen qubits is 65536 amplitudes, which is more rows than a
 * table is any use for.
 * @type {!int}
 */
const MAX_ROWS = 4096;

/**
 * The rows of the state table, derived from a circuit's output superposition.
 *
 * The simulator drops wires no gate touches, so its state can be shorter than the circuit on
 * screen. Those wires stayed |0>, which means the short state is a prefix of the full one and the
 * rest is zero, so the missing amplitudes read as zero rather than being relabelled.
 *
 * @param {!CircuitStats} stats
 * @param {!int} wireCount The number of wires the circuit shows.
 * @param {!int=} maxRows
 * @returns {!{
 *     amplitudeCount: !int,
 *     nonzeroCount: !int,
 *     rows: !Array.<!{
 *         ket: !string,
 *         probability: !number,
 *         real: !number,
 *         imag: !number,
 *         phaseDegrees: !number
 *     }>
 * }}
 */
function stateTableRows(stats, wireCount, maxRows=MAX_ROWS) {
    const buf = stats.finalState.rawBuffer();
    const amplitudeCount = 1 << wireCount;

    const rows = [];
    let nonzeroCount = 0;
    for (let i = 0; i < amplitudeCount; i++) {
        const real = i*2 < buf.length ? buf[i*2] : 0;
        const imag = i*2 + 1 < buf.length ? buf[i*2 + 1] : 0;
        const probability = real*real + imag*imag;
        if (!(probability > NEGLIGIBLE_PROBABILITY)) {
            continue;
        }

        nonzeroCount++;
        if (rows.length < maxRows) {
            rows.push({
                ket: Util.bin(i, wireCount),
                probability,
                real,
                imag,
                phaseDegrees: Math.atan2(imag, real) * 180 / Math.PI
            });
        }
    }

    return {amplitudeCount, nonzeroCount, rows};
}

export {stateTableRows}
