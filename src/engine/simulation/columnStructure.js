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

import {INPUT_LETTERS} from "../../circuit/model/InputLetters.js"
import {Controls} from "../../gates/probes/Controls.js"
import {Detectors} from "../../gates/probes/Detector.js"
import {HalfTurnGates} from "../../gates/rotations/HalfTurnGates.js"
import {ParametrizedRotationGates} from "../../gates/rotations/ParametrizedRotationGates.js"
import {QuarterTurnGates} from "../../gates/rotations/QuarterTurnGates.js"
import {Matrix} from "../math/matrix/Matrix.js"
import {preparedStateVector} from "../math/preparedStates.js"

/**
 * A column of the circuit as a *structure* rather than a matrix: which gate does what to which
 * wires, under which controls, with which basis changes around it.
 *
 * A column over 16 qubits is a 65,536 x 65,536 operator - 4.3 billion entries, far past what can be
 * built (asking one 16-qubit permutation gate for its dense matrix already exhausts memory). But
 * almost every column is a few small pieces: a permutation of a register, a 2x2 matrix on a wire,
 * a condition on some control bits. So instead of the matrix this keeps the pieces, and answers the
 * one question a view ever asks - where does this basis state go? - by running that basis state
 * through them. That costs the column's fan-out, not 4^n.
 *
 * It mirrors how the engine applies a column (src/engine/simulation/CircuitComputeUtil.js): the
 * setup operations of basis-changed and parity controls, then every enabled gate under the column's
 * controls, then the cleanup operations. test/engine/simulation/columnStructure.test.js holds it to
 * the engine's own answer, column by column.
 *
 * A gate built from a circuit is that circuit's columns, nested: each is a structure of its own,
 * placed on the gate's wires and run under the outer column's controls.
 *
 * Nothing here touches the DOM or the GPU, so a worker can rebuild a structure from the circuit's
 * JSON (src/draw/renderers/operatorTiles.worker.js).
 */

/** Past this a gate's dense matrix is too big to build; taller gates must declare a permutation. */
const MAX_DENSE_BLOCK_QUBITS = 10;
/** An amplitude this small is a zero that rounding left behind. */
const NEGLIGIBLE = 1e-12;

let knownGates = undefined;

/**
 * The gates whose effect lives outside their matrix, and what it is. Built on first use rather than
 * at import, so importing this module never depends on the gate modules having finished loading.
 *
 * @returns {!{basisChanges: !Map, inputRotations: !Map, detectors: !Set}}
 */
function gateTables() {
    if (knownGates === undefined) {
        // The basis a control on another axis moves its wire into, and back (src/gates/probes/Controls.js).
        const h = HalfTurnGates.H._knownMatrix.rawBuffer();
        const toY = QuarterTurnGates.SqrtXForward._knownMatrix.rawBuffer();
        const fromY = QuarterTurnGates.SqrtXBackward._knownMatrix.rawBuffer();
        const R = ParametrizedRotationGates;
        knownGates = {
            basisChanges: new Map([
                [Controls.XAntiControl, {setup: h, cleanup: h}],
                [Controls.XControl, {setup: h, cleanup: h}],
                [Controls.YAntiControl, {setup: toY, cleanup: fromY}],
                [Controls.YControl, {setup: toY, cleanup: fromY}],
                [Controls.XParityControl, {setup: h, cleanup: h}],
                [Controls.YParityControl, {setup: toY, cleanup: fromY}],
                [Controls.ZParityControl, {setup: undefined, cleanup: undefined}],
            ]),
            // Rotations by input A / 2^n of a half turn (src/gates/rotations/ParametrizedRotationGates.js).
            inputRotations: new Map([
                [R.XToA, {axis: 'X', factor: Math.PI}],
                [R.XToMinusA, {axis: 'X', factor: -Math.PI}],
                [R.YToA, {axis: 'Y', factor: Math.PI}],
                [R.YToMinusA, {axis: 'Y', factor: -Math.PI}],
                [R.ZToA, {axis: 'Z', factor: Math.PI}],
                [R.ZToMinusA, {axis: 'Z', factor: -Math.PI}],
            ]),
            detectors: new Set(Detectors.all),
        };
    }
    return knownGates;
}

/**
 * Where each input a gate reads comes from: a register on other wires, or a constant default.
 *
 * @param {!Gate} gate
 * @param {!Map.<!string, *>} context The column's context, including defaults set by earlier columns.
 * @returns {!Array.<!{offset: !int, length: !int, fallback: !int}>} In the order the gate's
 *     permutation takes them: A, B, then R.
 */
function inputsFor(gate, context) {
    const keys = gate.getUnmetContextKeys();
    return INPUT_LETTERS.
        filter(letter => keys.has(`Input Range ${letter}`)).
        map(letter => {
            const range = context.get(`Input Range ${letter}`);
            return range === undefined
                ? {offset: 0, length: 0, fallback: context.get(`Input Default ${letter}`) || 0}
                : {offset: range.offset, length: range.length, fallback: 0};
        });
}

/**
 * @param {!{offset: !int, length: !int, fallback: !int}} input
 * @param {!int} index A basis state.
 * @returns {!int} The input's value in that basis state.
 */
function readInput(input, index) {
    return input.length === 0 ? input.fallback : (index >> input.offset) & ((1 << input.length) - 1);
}

/**
 * The structure of one column over `wireCount` qubits, or the reason it has none.
 *
 * @param {!CircuitDefinition} circuit
 * @param {!int} colIndex
 * @param {!int} wireCount
 * @param {!number} time Time-dependent gates are read at this moment, like the simulation was.
 * @param {!int=} rowOffset Where the circuit's top wire is, when it is nested in a gate.
 * @param {undefined|!Map.<!string, *>=} outerContext The context around a nested circuit.
 * @returns {!ColumnStructure|!{ok: false, reason: !string}}
 *
 * @typedef {!{ok: true, wireCount: !int, inclusionMask: !int, desiredValueMask: !int,
 *     setup: !Array.<!Object>, core: !Array.<!Object>, cleanup: !Array.<!Object>}} ColumnStructure
 */
function columnStructure(circuit, colIndex, wireCount, time, rowOffset = 0, outerContext = undefined) {
    const {basisChanges, inputRotations, detectors} = gateTables();
    // A column past the circuit's end is empty: the circuit's JSON leaves out trailing empty columns.
    const gates = circuit.columns[colIndex]?.gates ?? [];
    // Input ranges are absolute wire positions, since the context is built at the circuit's offset.
    const columnContext = circuit.colCustomContextFromGates(colIndex, rowOffset);
    const context = outerContext === undefined ? columnContext : new Map([...outerContext, ...columnContext]);
    const controls = circuit.colControls(colIndex).shift(rowOffset);
    const setup = [];
    const core = [];
    const cleanup = [];

    for (let row = 0; row < gates.length; row++) {
        const gate = gates[row];
        if (gate === undefined || circuit.gateAtLocIsDisabledReason(colIndex, row) !== undefined) {
            continue;
        }
        const at = rowOffset + row;
        if (at + gate.height > wireCount) {
            return {ok: false, reason: "This step uses wires beyond the ones the state covers."};
        }

        // Operations that run around the column rather than under its controls.
        if (gate.customBeforeOperation !== undefined || gate.customAfterOperation !== undefined) {
            if (basisChanges.has(gate)) {
                const {setup: before, cleanup: after} = basisChanges.get(gate);
                if (before !== undefined) {
                    setup.push({kind: 'single', wire: at, m: before});
                    cleanup.unshift({kind: 'single', wire: at, m: after});
                }
            } else if (/^revinput/.test(gate.serializedId)) {
                // A reversed input is read big-endian: the engine reverses its wires around the column.
                const positions = Array.from({length: gate.height}, (_, i) => gate.height - 1 - i);
                setup.push({kind: 'bits', row: at, height: gate.height, positions});
                cleanup.unshift({kind: 'bits', row: at, height: gate.height, positions});
            } else if (detectors.has(gate)) {
                return {ok: false, reason: `The ${gate.name} measures at random, so this step is ` +
                    "not a linear operation and has no matrix."};
            } else {
                return {ok: false, reason: `The ${gate.name} acts around its column in a way ` +
                    "that has no matrix."};
            }
        }

        if (gate.isControl() || gate.isSwapHalf || gate.definitelyHasNoEffect()) {
            continue;
        }
        if (inputRotations.has(gate)) {
            const range = context.get('Input Range A');
            if (range === undefined) {
                return {ok: false, reason: `The ${gate.name} needs input A in its column.`};
            }
            core.push({kind: 'inputRotation', wire: at, ...inputRotations.get(gate),
                input: {offset: range.offset, length: range.length, fallback: 0}, cache: new Map()});
            continue;
        }
        if (gate.knownPreparation !== undefined) {
            // ψ⟨0…0|: the register's |0…0⟩ component becomes ψ, and its other components are discarded.
            const amplitudes = preparedStateVector(gate.knownPreparation, gate.height);
            let nonzero = 0;
            for (let v = 0; v < amplitudes.length; v += 2) {
                nonzero += amplitudes[v] !== 0 || amplitudes[v + 1] !== 0 ? 1 : 0;
            }
            core.push({kind: 'prepare', row: at, height: gate.height, amplitudes, nonzero});
            continue;
        }
        if (gate.knownPermutationFuncTakingInputs !== undefined) {
            core.push({kind: 'permutation', row: at, height: gate.height,
                func: gate.knownPermutationFuncTakingInputs, inputs: inputsFor(gate, context)});
            continue;
        }
        if (gate.knownBitPermutationFunc !== undefined) {
            const positions = Array.from({length: gate.height}, (_, i) => gate.knownBitPermutationFunc(i));
            core.push({kind: 'bits', row: at, height: gate.height, positions});
            continue;
        }
        const matrix = gate.height <= MAX_DENSE_BLOCK_QUBITS ? gate.knownMatrixAt(time) : undefined;
        if (matrix !== undefined) {
            core.push({kind: 'dense', row: at, height: gate.height, buffer: matrix.rawBuffer(), columns: []});
            continue;
        }
        if (gate.knownCircuit !== undefined) {
            // The engine runs the gate's circuit on its wires, re-checked for where it is placed
            // (setGateBuilderEffectToCircuit in src/engine/simulation/CircuitComputeUtil.js).
            const inner = gate.knownCircuit.withDisabledReasonsForEmbeddedContext(at, context);
            const structures = [];
            for (let c = 0; c < inner.columns.length; c++) {
                const built = columnStructure(inner, c, wireCount, time, at, context);
                if (!built.ok) {
                    return {ok: false, reason: `Inside the ${gate.name}: ${built.reason}`};
                }
                structures.push(built);
            }
            const fanOut = structures.reduce((product, built) => product * structureFanOut(built), 1);
            core.push({kind: 'nested', structures, fanOut: Math.min(fanOut, 1 << gate.height)});
            continue;
        }
        return {ok: false, reason: gate.height > MAX_DENSE_BLOCK_QUBITS
            ? `The ${gate.name} over ${gate.height} qubits declares no permutation, and its matrix ` +
                "is too large to build from its definition."
            : `The ${gate.name} has no known effect that can be written as a matrix.`};
    }

    // A pair of swap halves is one operation, applied under the controls like any other gate.
    const swapRows = circuit.colGetEnabledSwapGate(colIndex);
    if (swapRows !== undefined) {
        core.push({kind: 'swap', a: rowOffset + swapRows[0], b: rowOffset + swapRows[1]});
    }

    // Parity controls fold the parity of their wires into the one bit the column is controlled on,
    // after their basis changes, and unfold it before undoing them (parityGatherScatter in
    // src/gates/probes/Controls.js).
    if (controls.parityMask !== 0) {
        const target = Math.round(Math.log2(controls.parityMask & controls.inclusionMask));
        const fold = {kind: 'xorParity', target, mask: controls.parityMask & ~(1 << target)};
        setup.push(fold);
        cleanup.unshift(fold);
    }

    return {ok: true, wireCount, inclusionMask: controls.inclusionMask,
        desiredValueMask: controls.desiredValueMask, setup, core, cleanup};
}

/**
 * The 2x2 matrix of a rotation by `angle` around an axis, the way the parametrized rotation gates'
 * shaders build it: u = (1 + e^iθ)/2 on the diagonal.
 *
 * @param {!string} axis
 * @param {!number} angle
 * @returns {!Array.<!number>} Row-major, interleaved real and imaginary parts.
 */
function rotationMatrix(axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const ur = (1 + c) / 2, ui = s / 2;
    switch (axis) {
        case 'X': return [ur, ui, (1 - c) / 2, -s / 2, (1 - c) / 2, -s / 2, ur, ui];
        // v = i(1 - e^iθ)/2, as [[u, -v], [v, u]].
        case 'Y': return [ur, ui, -s / 2, -(1 - c) / 2, s / 2, (1 - c) / 2, ur, ui];
        default: return [1, 0, 0, 0, 0, 0, c, s];
    }
}

/**
 * @param {!Map.<!int, !Array.<!number>>} amplitudes
 * @param {!int} index
 * @param {!number} re
 * @param {!number} im
 */
function accumulate(amplitudes, index, re, im) {
    const existing = amplitudes.get(index);
    if (existing === undefined) {
        amplitudes.set(index, [re, im]);
    } else {
        existing[0] += re;
        existing[1] += im;
    }
}

/**
 * @param {!int} value
 * @param {!Array.<!int>} positions Where each of the low bits goes.
 * @returns {!int}
 */
function moveBits(value, positions) {
    let out = 0;
    for (let i = 0; i < positions.length; i++) {
        if ((value & (1 << i)) !== 0) {
            out |= 1 << positions[i];
        }
    }
    return out;
}

/**
 * Applies a 2x2 matrix to one wire of one basis state.
 */
function applySingle(out, m, wire, index, re, im) {
    const bit = (index >> wire) & 1;
    const cleared = index & ~(1 << wire);
    for (let target = 0; target < 2; target++) {
        const k = (target * 2 + bit) * 2;
        const mr = m[k], mi = m[k + 1];
        if (mr !== 0 || mi !== 0) {
            accumulate(out, cleared | (target << wire), re * mr - im * mi, re * mi + im * mr);
        }
    }
}

/**
 * The nonzero entries of one column of a gate's dense matrix, found once and kept.
 *
 * @param {!Object} op A 'dense' piece.
 * @param {!int} input
 * @returns {!Array.<!number>} Triples of target, real part, imaginary part.
 */
function denseColumn(op, input) {
    let entries = op.columns[input];
    if (entries === undefined) {
        const size = 1 << op.height;
        entries = [];
        for (let target = 0; target < size; target++) {
            const k = (target * size + input) * 2;
            if (op.buffer[k] !== 0 || op.buffer[k + 1] !== 0) {
                entries.push(target, op.buffer[k], op.buffer[k + 1]);
            }
        }
        op.columns[input] = entries;
    }
    return entries;
}

/**
 * Applies one piece of a column to a sparse state.
 *
 * @param {!Object} op
 * @param {!Map.<!int, !Array.<!number>>} amplitudes
 * @returns {!Map.<!int, !Array.<!number>>}
 */
function applyOp(op, amplitudes) {
    const out = new Map();
    for (const [index, [re, im]] of amplitudes) {
        switch (op.kind) {
            case 'single':
                applySingle(out, op.m, op.wire, index, re, im);
                break;
            case 'inputRotation': {
                const a = readInput(op.input, index);
                let m = op.cache.get(a);
                if (m === undefined) {
                    m = rotationMatrix(op.axis, a * op.factor / (1 << op.input.length));
                    op.cache.set(a, m);
                }
                applySingle(out, m, op.wire, index, re, im);
                break;
            }
            case 'dense': {
                const mask = (1 << op.height) - 1;
                const cleared = index & ~(mask << op.row);
                const entries = denseColumn(op, (index >> op.row) & mask);
                for (let e = 0; e < entries.length; e += 3) {
                    const mr = entries[e + 1], mi = entries[e + 2];
                    accumulate(out, cleared | (entries[e] << op.row), re * mr - im * mi, re * mi + im * mr);
                }
                break;
            }
            case 'prepare': {
                const mask = (1 << op.height) - 1;
                if (((index >> op.row) & mask) !== 0) {
                    break;
                }
                for (let v = 0; v <= mask; v++) {
                    const ar = op.amplitudes[v * 2], ai = op.amplitudes[v * 2 + 1];
                    if (ar !== 0 || ai !== 0) {
                        accumulate(out, index | (v << op.row), re * ar - im * ai, re * ai + im * ar);
                    }
                }
                break;
            }
            case 'permutation': {
                const mask = (1 << op.height) - 1;
                const inputs = op.inputs.map(input => readInput(input, index));
                const target = op.func((index >> op.row) & mask, ...inputs) & mask;
                accumulate(out, (index & ~(mask << op.row)) | (target << op.row), re, im);
                break;
            }
            case 'bits': {
                const mask = (1 << op.height) - 1;
                const moved = moveBits((index >> op.row) & mask, op.positions);
                accumulate(out, (index & ~(mask << op.row)) | (moved << op.row), re, im);
                break;
            }
            case 'swap': {
                const differ = ((index >> op.a) ^ (index >> op.b)) & 1;
                accumulate(out, differ === 0 ? index : index ^ (1 << op.a) ^ (1 << op.b), re, im);
                break;
            }
            case 'nested': {
                let inner = new Map([[index, [re, im]]]);
                for (const structure of op.structures) {
                    inner = evolve(structure, inner);
                }
                for (const [k, [r, i]] of inner) {
                    accumulate(out, k, r, i);
                }
                break;
            }
            case 'xorParity': {
                let parity = 0;
                for (let bits = index & op.mask; bits !== 0; bits &= bits - 1) {
                    parity ^= 1;
                }
                accumulate(out, index ^ (parity << op.target), re, im);
                break;
            }
            default:
                throw new Error(`Unknown column piece: ${op.kind}`);
        }
    }
    return out;
}

/**
 * Applies a whole column to a sparse state: setup, then the gates where the controls allow -
 * everywhere else the column is the identity - then cleanup.
 *
 * @param {!ColumnStructure} structure
 * @param {!Map.<!int, !Array.<!number>>} amplitudes
 * @returns {!Map.<!int, !Array.<!number>>}
 */
function evolve(structure, amplitudes) {
    for (const op of structure.setup) {
        amplitudes = applyOp(op, amplitudes);
    }
    let acted = new Map();
    const passed = [];
    for (const [index, amp] of amplitudes) {
        if ((index & structure.inclusionMask) === structure.desiredValueMask) {
            acted.set(index, amp);
        } else {
            passed.push([index, amp]);
        }
    }
    for (const op of structure.core) {
        acted = applyOp(op, acted);
    }
    for (const [index, [re, im]] of passed) {
        accumulate(acted, index, re, im);
    }
    amplitudes = acted;
    for (const op of structure.cleanup) {
        amplitudes = applyOp(op, amplitudes);
    }
    return amplitudes;
}

/**
 * Where one basis state goes under the column: the nonzero amplitudes of U|basis⟩.
 *
 * @param {!ColumnStructure} structure
 * @param {!int} basis
 * @returns {!Map.<!int, !Array.<!number>>} Output basis state -> [re, im].
 */
function columnImage(structure, basis) {
    const amplitudes = evolve(structure, new Map([[basis, [1, 0]]]));
    for (const [index, [re, im]] of amplitudes) {
        if (re * re + im * im < NEGLIGIBLE * NEGLIGIBLE) {
            amplitudes.delete(index);
        }
    }
    return amplitudes;
}

/**
 * At most how many basis states one basis state spreads over: what one column of the operator
 * costs to work out. A permutation is 1; a Hadamard on every one of n wires is 2^n.
 *
 * @param {!ColumnStructure} structure
 * @returns {!number}
 */
function structureFanOut(structure) {
    let fanOut = 1;
    for (const op of [...structure.setup, ...structure.core, ...structure.cleanup]) {
        if (op.kind === 'single' || op.kind === 'inputRotation') {
            fanOut *= 2;
        } else if (op.kind === 'dense') {
            fanOut *= 1 << op.height;
        } else if (op.kind === 'prepare') {
            fanOut *= op.nonzero;
        } else if (op.kind === 'nested') {
            fanOut *= op.fanOut;
        }
    }
    return Math.min(fanOut, 1 << structure.wireCount);
}

/**
 * The column's dense matrix, built one basis state at a time. Only for small registers: it has
 * 4^n entries.
 *
 * @param {!ColumnStructure} structure
 * @returns {!Matrix}
 */
function structureMatrix(structure) {
    const size = 1 << structure.wireCount;
    const buffer = new Float64Array(size * size * 2);
    for (let basis = 0; basis < size; basis++) {
        for (const [row, [re, im]] of columnImage(structure, basis)) {
            buffer[(row * size + basis) * 2] = re;
            buffer[(row * size + basis) * 2 + 1] = im;
        }
    }
    return new Matrix(size, size, buffer);
}

/**
 * The column applied to a whole state, or undefined when that would take more than `budget`
 * amplitude updates. Zero amplitudes cost nothing, so a state with few nonzero amplitudes is cheap
 * at any size; a column that spreads every basis state over the register, like a Hadamard on
 * every wire of a uniform superposition, is not.
 *
 * @param {!ColumnStructure} structure
 * @param {!Matrix} state A column vector over the structure's wires.
 * @param {!number} budget
 * @returns {undefined|!Matrix}
 */
function applyStructure(structure, state, budget) {
    const source = state.rawBuffer();
    const size = 1 << structure.wireCount;
    const buffer = new Float64Array(size * 2);
    const fanOut = structureFanOut(structure);
    let spent = 0;
    for (let basis = 0; basis < size; basis++) {
        const ar = source[basis * 2], ai = source[basis * 2 + 1];
        if (ar * ar + ai * ai < NEGLIGIBLE * NEGLIGIBLE) {
            continue;
        }
        spent += fanOut;
        if (spent > budget) {
            return undefined;
        }
        for (const [row, [re, im]] of columnImage(structure, basis)) {
            buffer[row * 2] += ar * re - ai * im;
            buffer[row * 2 + 1] += ar * im + ai * re;
        }
    }
    return new Matrix(1, size, buffer);
}

export {applyStructure, columnImage, columnStructure, structureFanOut, structureMatrix}
