import {Matrix} from "../math/matrix/Matrix.js"
import {Controls} from "../../circuit/model/Controls.js"
import {firstTimeDependentColumn} from "./CircuitCheckpoints.js"

/**
 * The most wires one fused pass covers. qsim fuses up to four on a GPU, and
 * GateShaders.applyMatrixOperation goes that far too, but its four-qubit matrices go through a
 * texture and each output reads sixteen amplitudes: in test_perf, fusing four wires made the 16-qubit
 * QFT slower than not fusing at all, while three wires sped up both it and the brickwork circuit.
 */
const MAX_FUSED_WIRES = 3;

/**
 * Gate fusion, as in qsim: within a run of adjacent quiet columns, each gate and its column's
 * controls is an operation on the wires it touches, and operations that share wires merge into one
 * matrix over at most MAX_FUSED_WIRES adjacent wires, applied in one pass instead of one per gate
 * when that takes fewer passes.
 * Operations on disjoint wires commute, so a merged block can take in later operations on its wires
 * while blocks on other wires wait. An operation wider than that (a control far from its target) is
 * applied on its own, after the blocks it shares wires with.
 *
 * A run only holds columns that nothing observes between: no displays or other statistics, no
 * non-unitary gates (their columns read the norm), no measurements, swaps, before/after operations
 * or parity controls, and only gates whose known matrix is their whole effect. No run crosses into
 * the first time-dependent column, so an animating circuit still has a state saved just before it
 * (CircuitCheckpoints), where every frame starts.
 */

/**
 * @typedef {!{row: !int, height: !int, matrix: !Matrix, controls: !Controls, wires: !int, lo: !int, hi: !int}} Operation
 * One gate under its column's controls: the wires it acts on or is controlled by, and their range.
 */

/**
 * @typedef {!{row: !int, matrix: !Matrix, controls: !Controls}} Step
 * A matrix applied to the wires from `row` up, under `controls` (and whatever controls surround the run).
 */

/**
 * @param {!CircuitDefinition} circuit
 * @param {!int} col
 * @param {!number} time
 * @returns {undefined|!Array.<!Operation>} Undefined when the column can't be part of a fused run.
 */
function columnOperations(circuit, col, time) {
    const column = circuit.columns[col];
    const controls = circuit.colControls(col);
    if (controls.parityMask !== 0 ||
            column.indexOfNonUnitaryGate() !== undefined ||
            circuit.customStatRowsInCol(col).length > 0 ||
            circuit.colDesiredSingleQubitStatsMask(col) !== 0) {
        return undefined;
    }

    const operations = [];
    for (let row = 0; row < circuit.numWires; row++) {
        const gate = column.gates[row];
        if (gate === undefined || circuit.gateAtLocIsDisabledReason(col, row) !== undefined) {
            continue;
        }
        if (gate.customBeforeOperation !== undefined || gate.customAfterOperation !== undefined ||
                gate.isSwapHalf || gate.measureEffect !== undefined) {
            return undefined;
        }
        if (gate.definitelyHasNoEffect()) {
            continue;
        }
        // A known matrix is the gate's effect (AllGates.test checks custom operations against it, and
        // the algebra panel's columnStructure relies on it too), unless the gate reads other wires.
        if (gate.getUnmetContextKeys().size > 0 || gate.knownPreparation !== undefined ||
                gate.knownPermutationFuncTakingInputs !== undefined || gate.knownCircuit !== undefined ||
                gate.height > MAX_FUSED_WIRES) {
            return undefined;
        }
        const matrix = gate.knownMatrixAt(time);
        if (matrix === undefined || matrix.width() !== 1 << gate.height) {
            return undefined;
        }
        const wires = controls.inclusionMask | ((1 << gate.height) - 1) << row;
        operations.push({row, height: gate.height, matrix, controls, wires,
            lo: Math.log2(wires & -wires), hi: Math.floor(Math.log2(wires))});
    }
    return operations;
}

/**
 * The run of quiet columns starting at the given one, as the fused steps that apply it.
 *
 * @param {!CircuitDefinition} circuit
 * @param {!int} col
 * @param {!number} time
 * @param {!function(!int): !boolean} mustStopBefore Whether the state from just before a column is
 *     wanted (a checkpoint saves it), so no run may carry on into that column.
 * @returns {undefined|!{end: !int, steps: !Array.<!Step>}} The column after the run and the steps, in
 *     order; undefined when the column can't start a run.
 */
function fusedRunAt(circuit, col, time, mustStopBefore = () => false) {
    const operations = [];
    const firstTimeDependent = firstTimeDependentColumn(circuit);
    let end = col;
    while (end < circuit.columns.length &&
            (end === col || (end !== firstTimeDependent && !mustStopBefore(end)))) {
        const columnOps = columnOperations(circuit, end, time);
        if (columnOps === undefined) {
            break;
        }
        operations.push(...columnOps);
        end++;
    }
    if (end === col) {
        return undefined;
    }

    /** @type {!Array.<!{wires: !int, lo: !int, hi: !int, operations: !Array.<!Operation>}>} */
    let open = [];
    const steps = [];
    const close = block => steps.push(...blockSteps(block));
    for (const op of operations) {
        const touching = open.filter(block => (block.wires & op.wires) !== 0);
        const others = open.filter(block => (block.wires & op.wires) === 0);
        const lo = Math.min(op.lo, ...touching.map(block => block.lo));
        const hi = Math.max(op.hi, ...touching.map(block => block.hi));
        if (hi - lo + 1 <= MAX_FUSED_WIRES) {
            const wires = touching.reduce((total, block) => total | block.wires, op.wires);
            open = [...others, {wires, lo, hi, operations: [...touching.flatMap(block => block.operations), op]}];
            continue;
        }
        // The blocks it shares wires with come first; the rest can still take in later operations.
        touching.forEach(close);
        if (op.hi - op.lo + 1 <= MAX_FUSED_WIRES) {
            open = [...others, {wires: op.wires, lo: op.lo, hi: op.hi, operations: [op]}];
        } else {
            open = others;
            steps.push(operationStep(op));
        }
    }
    open.forEach(close);
    return {end, steps};
}

/**
 * @param {!Operation} op
 * @returns {!Step} The gate applied on its own, the way the column would apply it.
 */
function operationStep(op) {
    return {row: op.row, matrix: op.matrix, controls: op.controls};
}

/**
 * How many passes over the state a matrix on this many wires takes: four-qubit matrices go through
 * a texture, which takes a pass of its own (GateShaders.applyMatrixOperation).
 * @param {!int} wires
 * @returns {!int}
 */
function passesFor(wires) {
    return wires === 4 ? 2 : 1;
}

/**
 * @param {!{lo: !int, hi: !int, operations: !Array.<!Operation>}} block
 * @returns {!Array.<!Step>} One matrix for the block, with its controls inside, when that takes fewer
 *     passes than its gates one by one; otherwise its gates as they are.
 */
function blockSteps({lo, hi, operations}) {
    const span = hi - lo + 1;
    const separately = operations.reduce((total, op) => total + passesFor(op.height), 0);
    if (separately <= passesFor(span)) {
        return operations.map(operationStep);
    }
    const n = 1 << span;
    let matrix = Matrix.identity(n);
    for (const op of operations) {
        matrix = applyOperation(op, lo, span, matrix);
    }
    return [{row: lo, matrix, controls: Controls.NONE}];
}

/**
 * Applies an operation to each column of a matrix over the wires lo..lo+span-1, the way a pass applies
 * it to the state: its gate's matrix on the states meeting its controls, nothing on the others. This
 * multiplies by the operation's matrix without building it. Computed in float64, like Matrix.
 *
 * @param {!Operation} op
 * @param {!int} lo
 * @param {!int} span
 * @param {!Matrix} target
 * @returns {!Matrix}
 */
function applyOperation({row, height, matrix, controls}, lo, span, target) {
    const n = 1 << span;
    const used = controls.inclusionMask >> lo;
    const desired = controls.desiredValueMask >> lo;
    const offset = row - lo;
    const size = 1 << height;
    const mask = (size - 1) << offset;
    const coefs = matrix.rawBuffer();
    const src = target.rawBuffer();

    const buf = new Float64Array(src.length);
    for (let out = 0; out < n; out++) {
        const k = out * n * 2;
        // States not meeting the controls keep their row; the controls' wires don't change.
        if ((out & used) !== desired) {
            buf.set(src.subarray(k, k + n * 2), k);
            continue;
        }
        const a = (out & mask) >> offset;
        const rest = out & ~mask;
        for (let b = 0; b < size; b++) {
            const mr = coefs[(a * size + b) * 2];
            const mi = coefs[(a * size + b) * 2 + 1];
            if (mr === 0 && mi === 0) {
                continue;
            }
            const j = (rest | (b << offset)) * n * 2;
            for (let c = 0; c < n * 2; c += 2) {
                const sr = src[j + c];
                const si = src[j + c + 1];
                buf[k + c] += mr * sr - mi * si;
                buf[k + c + 1] += mr * si + mi * sr;
            }
        }
    }
    return new Matrix(n, n, buf);
}

export {fusedRunAt}
