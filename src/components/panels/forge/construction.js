import {Axis} from '../../../engine/math/formula/Axis.js';
import {parseAngleExpression} from '../../../engine/math/formula/AngleExpression.js';
import {Matrix} from '../../../engine/math/matrix/Matrix.js';
import {GateBuilder} from '../../../circuit/model/Gate.js';
import {GateColumn} from '../../../circuit/model/GateColumn.js';
import {MATRIX_RENDERER,LABEL_RENDERER,LOCATION_INDEPENDENT_GATE_RENDERER} from '../../../draw/gate/GateRenderers.js';
import {renderCustomGateCircuit} from '../../../draw/gate/CustomGateCircuitRenderer.js';
import {setGateBuilderEffectToCircuit} from '../../../engine/simulation/CircuitComputeUtil.js';
import {parseUserRotation, parseUserMatrix, parseUserGateFromCircuitRange} from '../../../serialization/customGateParsing.js';

export function normalizedAxis(text) {
    let axis;
    try { axis = Axis.parse(text); } catch { throw new Error('Enter an axis, such as X, Y, Z, or X+Z.'); }
    const components = [axis.x, axis.y, axis.z];
    const length = Math.hypot(...components);
    if (!components.every(Number.isFinite) || !Number.isFinite(length) || length === 0) {
        throw new Error('Axis must be finite and nonzero.');
    }
    return components.map(value => value / length);
}

export function parseRotationDraft({axis, angle, phase, unit}) {
    normalizedAxis(axis);
    const rotation = parseAngleExpression(angle, unit);
    let global;
    try { global = parseAngleExpression(phase, unit); } catch (error) { throw new Error(`Global phase: ${error.message}`, {cause:error}); }
    return parseUserRotation(String(rotation.degrees), String(global.degrees), axis);
}

export function inspectMatrix(matrix) {
    const n = matrix.width();
    if (n !== matrix.height() || ![2, 4, 8, 16].includes(n)) throw new Error('Choose a 2×2, 4×4, 8×8, or 16×16 matrix.');
    if (![...matrix.rawBuffer()].every(Number.isFinite)) throw new Error('Every matrix entry must be finite.');
    return {
        qubits: Math.log2(n), unitary: matrix.isUnitary(0.009),
        residual: Math.sqrt(matrix.adjoint().times(matrix).minus(Matrix.identity(n)).norm2()),
    };
}

export function parseMatrixDraft(text, corrected = false) {
    if (!text.trim()) throw new Error('Enter a matrix.');
    // The formula parser accepts unfinished trailing operators; an editor must not create those.
    if (/[+*/^-]\s*(?:[,}\]]|$)/.test(text)) throw new Error('Complete every matrix expression.');
    const matrix = parseUserMatrix(text, corrected);
    inspectMatrix(matrix);
    return matrix;
}

export function buildMatrixGate(matrix, name, kind = 'Matrix') {
    const qubits = Math.log2(matrix.height());
    const builder = new GateBuilder().setSerializedId('~preview').setSymbol(name.trim())
        .setTitle(`Custom ${kind} Gate`).setHeight(qubits)
        .setWidth(kind === 'Rotation' || name.trim() ? 1 : qubits)
        .setRenderer(!name.trim() ? MATRIX_RENDERER : matrix.isIdentity() ? LABEL_RENDERER : matrix.isScaler() ? LOCATION_INDEPENDENT_GATE_RENDERER : undefined)
        .setKnownEffectToMatrix(matrix);
    if (matrix.isIdentity()) builder.markAsNotInterestedInControls();
    return builder.gate;
}

function strictRange(text, max, label) {
    const match = /^\s*(\d+)\s*(?::\s*(\d+|∞)\s*)?$/.exec(text);
    if (!match) throw new Error(`${label}: use a range such as 1:3 or 1:∞.`);
    const start = Number(match[1]);
    const end = match[2] === '∞' || match[2] === undefined ? max : Number(match[2]);
    if (!Number.isSafeInteger(start) || start < 1 || start > end || end > max) {
        throw new Error(`${label}: choose an ordered range within 1:${max}.`);
    }
    return [start - 1, end];
}

function occupiedColumns(circuit) {
    return circuit.columns.reduce((end,column,col) => Math.max(end,...column.gates.map(gate => gate ? col+gate.width : 0)),circuit.columns.length);
}

/** Serialized circuits can omit empty columns occupied by the end of a wide gate. */
export function parseCircuitDraft(circuit, {cols,rows,name}) {
    const range = validateCircuitRange(circuit,cols,rows);
    const padded = circuit.withColumns([...circuit.columns,...Array.from({length:occupiedColumns(circuit)-circuit.columns.length},() => new GateColumn(new Array(circuit.numWires).fill(undefined)))]);
    const extracted = parseUserGateFromCircuitRange(padded,cols,rows,name.trim());
    // Saved custom circuits omit unused trailing wires; preview the same gate that reopening produces.
    const gate = setGateBuilderEffectToCircuit(new GateBuilder(),extracted.knownCircuit.withMinimumWireCount())
        .setSerializedId(extracted.serializedId).setSymbol(extracted.symbol).setTitle(extracted.name)
        .setBlurb(extracted.blurb).setRenderer(renderCustomGateCircuit).gate;
    return {range,gate};
}

export function validateCircuitRange(circuit, colsText, rowsText) {
    const [colStart, colEnd] = strictRange(colsText, occupiedColumns(circuit), 'Columns');
    const [wireStart, wireEnd] = strictRange(rowsText, circuit.numWires, 'Wires');
    let count = 0;
    circuit.columns.forEach((column, col) => column.gates.forEach((gate, row) => {
        if (!gate || col >= colEnd || col + gate.width <= colStart || row >= wireEnd || row + gate.height <= wireStart) return;
        if (col < colStart || col + gate.width > colEnd || row < wireStart || row + gate.height > wireEnd) {
            throw new Error(`Include the whole ${gate.symbol || 'gate'} at wire ${row + 1}, column ${col + 1}.`);
        }
        count++;
    }));
    if (!count) throw new Error('No gates in the selected range.');
    return {colStart, colEnd, wireStart, wireEnd};
}
