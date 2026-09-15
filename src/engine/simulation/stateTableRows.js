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

import { bin } from "../../base/Format.js";
import {Registers} from "../../circuit/model/Registers.js"
import {ketBits, registerValue} from "../../circuit/registerLabels.js"

/**
 * The registers' values read as one word, in wire order: AGA when every value is a single letter,
 * six·A or 1·G when one is longer or a number, so that two values never run together into a third.
 *
 * @param {!Array.<!string>} values
 * @returns {!string}
 */
function joinedSequence(values) {
    return values.join(values.every(v => v.length === 1 && !/[0-9]/.test(v)) ? "" : "·");
}

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
 *     registers: !Registers,
 *     rows: !Array.<!{
 *         ket: !string,
 *         bits: !string,
 *         values: !Array.<!string>,
 *         sequence: !string,
 *         bits: !string,
 *         values: !Array.<!int>,
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

    // Registers are named in the table; each row carries their values and its bits grouped by them.
    const registers = stats.circuitDefinition.registers.fittingIn(wireCount);
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
            const values = registers.list.map(r => Registers.valueLabel(r, registerValue(r, i)));
            rows.push({
                ket: bin(i, wireCount),
                bits: ketBits(registers, wireCount, i),
                values,
                // The registers read together: a sequence, when they are the letters of one.
                sequence: joinedSequence(values),
                probability,
                real,
                imag,
                phaseDegrees: Math.atan2(imag, real) * 180 / Math.PI
            });
        }
    }

    return {amplitudeCount, nonzeroCount, rows, registers};
}

export {stateTableRows}
