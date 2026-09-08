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

import {Axis} from '../../engine/math/formula/Axis.js';
import {CircuitDefinition} from '../../circuit/model/CircuitDefinition.js';
import {setGateBuilderEffectToCircuit} from '../../engine/simulation/CircuitComputeUtil.js';
import {Complex} from '../../engine/math/complex/Complex.js';
import {DetailedError} from '../../base/DetailedError.js';
import {Format} from '../../base/Format.js';
import {GateBuilder} from '../../circuit/model/Gate.js';
import {GateColumn} from '../../circuit/model/GateColumn.js';
import {Matrix} from '../../engine/math/matrix/Matrix.js';
import {seq} from '../../base/Seq.js';
import {Util} from '../../base/Util.js';
import {MatrixDecomposition} from '../../engine/math/matrix/MatrixDecomposition.js';
import {QubitMatrix} from '../../engine/math/matrix/QubitMatrix.js';
import {ComplexFormula} from '../../engine/math/formula/ComplexFormula.js';

/**
 * Turns the text the gate forge accepts into operations and gates: rotation angles and axes,
 * matrices in several loose notations, and column and wire ranges of the current circuit. Pure
 * functions, no DOM; the forge dialog calls them and paints the results.
 */

/**
 * @returns {!string} A serialized id unlikely to collide with any other custom gate's.
 */
function randomCustomGateId() {
    return '~' + Math.floor(Math.random()*(1 << 20)).toString(32);
}

/**
 * @param {!HTMLInputElement} textBox
 * @returns {!string}
 */
function valueElsePlaceholder(textBox) {
    return textBox.value === '' ? textBox.placeholder : textBox.value;
}

/**
 * @param {!string} text
 * @returns {!number}
 */
function parseUserAngle(text) {
    let c = ComplexFormula.parse(text);
    if (c.imag !== 0 || isNaN(c.imag)) {
        throw new Error("You just had to make it complicated, didn't you?");
    }
    return c.real * Math.PI / 180;
}

/**
 * @param {!Matrix} matrix
 * @returns {!Matrix}
 */
function decreasePrecisionAndSerializedSize(matrix) {
    return Matrix.parse(matrix.toString(new Format(true, 0.0000001, 7, ",")))
}

/**
 * @param {!string} angleText
 * @param {!string} phaseText
 * @param {!string} axisText
 * @returns {!Matrix}
 */
function parseUserRotation(angleText, phaseText, axisText) {
    let w = parseUserAngle(angleText);
    let phase = parseUserAngle(phaseText);
    let {x, y, z} = Axis.parse(axisText);

    let len = Math.sqrt(x*x + y*y + z*z);
    x /= len;
    y /= len;
    z /= len;

    let [I, X, Y, Z] = [Matrix.identity(2), QubitMatrix.PAULI_X, QubitMatrix.PAULI_Y, QubitMatrix.PAULI_Z];
    let axisMatrix = X.times(x).plus(Y.times(y)).plus(Z.times(z));

    let result = I.times(Math.cos(w/2)).
        plus(axisMatrix.times(Complex.I.neg()).times(Math.sin(w/2))).
        times(Complex.polar(1, phase));
    if (result.hasNaN()) {
        throw new DetailedError("NaN", {x, y, z, result});
    }

    return decreasePrecisionAndSerializedSize(result);
}

/**
 * @param {!string} text
 * @returns {!Matrix}
 */
function parseUserGateMatrix_noCorrection(text) {
    // If brackets are present, use the normal parse method that enforces grouping.
    if (text.match(/[\{}\[\]]/)) {
        return Matrix.parse(text.split(/[\{\[]/).join('{').split(/[}\]]/).join('}'));
    }

    // Newlines introduce a break if one isn't already present at that location and we aren't at the end.
    text = text.split(/,?\s*\n\s*(?!$)/).join(',');
    text = text.trim();
    // Ignore trailing comma.
    if (text.endsWith(',')) {
        text = text.substring(0, text.length - 1);
    }

    let parts = text.split(',').map(e => e === '' ? 0 : ComplexFormula.parse(e));

    // Expand singleton cell into a 2x2 global phase operation.
    if (parts.length === 1) {
        parts.push(0, 0, parts[0]);
    }

    // Pad with zeroes up to next size that makes sense.
    let n = Math.max(4, 1 << (2*Math.max(1, Util.floorLg2(Math.sqrt(parts.length)))));
    if (n < parts.length) {
        n <<= 2;
    }
    if (n > (1<<8)) {
        throw Error("Max custom matrix operation size is 4 qubits.")
    }
    return Matrix.square(...parts, ...new Array(n - parts.length).fill(0));
}

/**
 * @param {!string} text
 * @param {!boolean} ensureUnitary
 * @returns {!Matrix}
 */
function parseUserMatrix(text, ensureUnitary) {
    let op = parseUserGateMatrix_noCorrection(text);
    if (op.width() !== op.height() || op.width() < 2 || op.width() > 16 || !Util.isPowerOf2(op.width())) {
        throw Error("Matrix must be 2x2, 4x4, 8x8, or 16x16.")
    }
    if (ensureUnitary && !op.hasNaN()) {
        op = MatrixDecomposition.closestUnitary(op, 0.0001);
        op = decreasePrecisionAndSerializedSize(op);
    }
    return op;
}

/**
 * @param {!string} text
 * @param {!int} maxLen
 * @returns {{start: !int, end: !int}}
 */
function parseRange(text, maxLen) {
    let parts = text.split(":").map(e => e.trim());
    if (parts.length > 2) {
        throw new Error("Too many colons.");
    }
    let infinities = [undefined, "", "∞"];
    let min = parseInt(parts[0] || "1");
    let max = infinities.indexOf(parts[1]) !== -1 ? Infinity : parseInt(parts[1]);
    if (isNaN(min)) {
        throw new Error("Not a number: " + parts[0]);
    }
    if (isNaN(max)) {
        throw new Error("Not a number: " + parts[1]);
    }

    let start = Math.min(maxLen, Math.max(0, min - 1));
    let end = Math.min(maxLen, Math.max(start, max));
    return {start, end};
}

/**
 * @param {!CircuitDefinition} circuit
 * @returns {!CircuitDefinition}
 */
function removeBrokenGates(circuit) {
    let w = circuit.columns.length;
    let h = circuit.numWires;
    return circuit.withColumns(
        seq(circuit.columns).mapWithIndex(
            (col, c) => new GateColumn(seq(col.gates).mapWithIndex(
                (gate, r) => gate === undefined || c + gate.width > w || r + gate.height > h ? undefined : gate
            ).toArray())
        ).toArray());
}

/**
 * @param {!CircuitDefinition} circuit
 * @param {!string} colRangeText
 * @param {!string} wireRangeText
 * @param {!string} nameText
 * @returns {!Gate}
 */
function parseUserGateFromCircuitRange(circuit, colRangeText, wireRangeText, nameText) {
    let colRange = parseRange(colRangeText, circuit.columns.length);
    let rowRange = parseRange(wireRangeText, circuit.numWires);
    if (rowRange.end === rowRange.start) {
        throw new Error("Empty wire range.")
    }

    let cols = circuit.columns.
        slice(colRange.start, colRange.end).
        map(col => new GateColumn(col.gates.slice(rowRange.start, rowRange.end)));
    let gateCircuit = new CircuitDefinition(rowRange.end - rowRange.start, cols);
    gateCircuit = removeBrokenGates(gateCircuit);
    gateCircuit = gateCircuit.withUncoveredColumnsRemoved();
    if (gateCircuit.columns.length === 0) {
        throw new Error("No gates in included range.");
    }

    let symbol = nameText;
    let id = randomCustomGateId();

    return setGateBuilderEffectToCircuit(new GateBuilder(), gateCircuit).
        setSerializedId(id).
        setSymbol(symbol).
        setTitle(id).
        setBlurb('A custom gate.').
        gate;
}

export {
    randomCustomGateId,
    valueElsePlaceholder,
    parseUserAngle,
    parseUserRotation,
    parseUserMatrix,
    parseRange,
    parseUserGateFromCircuitRange,
}
