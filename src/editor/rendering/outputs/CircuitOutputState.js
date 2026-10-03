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

import {Matrix} from '../../../engine/math/matrix/Matrix.js';
import {phaseReferenceIndex, withPhaseReference} from '../../../engine/math/phaseReference.js';
import {ketLabel} from '../../../circuit/registerLabels.js';
import {formatProbability, ZERO_PROBABILITY} from '../../../draw/displays/probability/ProbabilityScale.js';

/** Adapts existing simulation amplitudes to the displayed grid; performs no simulation. */
export function outputStateAsMatrix(stats, numWire) {
    let buf = stats.finalState.rawBuffer();
    if (stats.circuitDefinition.numWires !== numWire) {
        const r = new Float32Array(2 << numWire);
        r.set(buf.slice(0, r.length));
        buf = r;
    }

    const [colWires, rowWires] = [Math.floor(numWire/2), Math.ceil(numWire/2)];
    const [colCount, rowCount] = [1 << colWires, 1 << rowWires];
    return new Matrix(colCount, rowCount, buf);
}

/** The most outcomes the grid's description names; the rest it counts. */
const DESCRIBED_OUTCOMES = 8;

/**
 * The state-vector grid in words, for someone who does not see the canvas: the likeliest outcomes,
 * each with its chance and, when it is not zero, its phase, measured from the amplitude the grid
 * measures them from.
 *
 * @param {!CircuitDefinition} definition
 * @param {!CircuitStats} stats The stats the grid shows: the playhead's, when it follows it.
 * @param {!int} numWire
 * @param {undefined|!int} operation How many operations the playhead has passed, when the grid
 *     follows it.
 * @returns {!string}
 */
export function describeOutputState(definition, stats, numWire, operation = undefined) {
    const where = operation === undefined ? 'Output state' :
        operation === 0 ? 'State before the first operation' : `State after operation ${operation}`;
    const matrix = outputStateAsMatrix(stats, numWire);
    if (matrix.hasNaN()) {
        return `${where}: could not be worked out.`;
    }
    const reference = phaseReferenceIndex(matrix.rawBuffer());
    const buf = withPhaseReference(matrix.rawBuffer(), reference);
    const registers = definition.registers.fittingIn(numWire);
    const ket = index => `|${ketLabel(registers, numWire, index)}⟩`;
    const outcomes = [];
    for (let i = 0; i < buf.length / 2; i++) {
        const p = buf[2 * i] ** 2 + buf[2 * i + 1] ** 2;
        if (p > ZERO_PROBABILITY) outcomes.push({i, p});
    }
    outcomes.sort((a, b) => b.p - a.p || a.i - b.i);
    const named = outcomes.slice(0, DESCRIBED_OUTCOMES).map(({i, p}) => {
        // Whole degrees in (−180°, 180°], as the wheel labels them.
        let phase = Math.round(Math.atan2(buf[2 * i + 1], buf[2 * i]) * 180 / Math.PI);
        if (phase === -180) phase = 180;
        const turned = phase === 0 ? '' : ` at ${phase < 0 ? '−' : ''}${Math.abs(phase)}°`;
        return `${ket(i)} ${formatProbability(p)}${turned}`;
    });
    const rest = outcomes.length - named.length;
    const more = rest > 0 ? `, and ${rest} more` : '';
    return `${where}: ${named.join(', ')}${more}. Phases measured from ${ket(reference)}.`;
}
