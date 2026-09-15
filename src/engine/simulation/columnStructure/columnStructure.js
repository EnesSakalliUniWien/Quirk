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

import {INITIAL_STATES_TO_GATES} from "../../../gates/AllGates.js";
import {preparedStateVector} from "../../math/preparedStates.js";
import {gateTables, inputsFor} from "./gateContext.js";
import {structureFanOut} from "./evaluation.js";

/** @typedef {import("../../../circuit/model/CircuitDefinition.js").CircuitDefinition} CircuitDefinition */

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
 * A gate built from a circuit starts with its initial-state operations, then its nested columns.
 * Each structure is placed on the gate's wires and run under the outer column's controls.
 *
 * Nothing here touches the DOM or the GPU, so a worker can rebuild a structure from the circuit's
 * JSON (src/draw/renderers/operatorTiles.worker.js).
 */

/** Past this, use a gate's declared operations or nested circuit instead of its dense matrix. */
const MAX_DENSE_BLOCK_QUBITS = 10;

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
    const context = columnContext(circuit, colIndex, rowOffset, outerContext);
    const controls = circuit.colControls(colIndex).shift(rowOffset);
    const structure = emptyStructure(wireCount, controls.inclusionMask, controls.desiredValueMask);
    const failure = appendGateOperations(circuit, colIndex, rowOffset, time, context, structure);
    if (failure !== undefined) {
        return failure;
    }
    appendSwapOperation(circuit, colIndex, rowOffset, structure);
    appendParityOperations(controls, structure);
    return structure;
}

/** Creates the setup/core/cleanup representation, optionally under controls. */
function emptyStructure(wireCount, inclusionMask = 0, desiredValueMask = 0) {
    return {ok: true, wireCount, inclusionMask, desiredValueMask, setup: [], core: [], cleanup: []};
}

/** Resolves absolute inputs, allowing the inner column to override its outer context. */
function columnContext(circuit, colIndex, rowOffset, outerContext) {
    const local = circuit.colCustomContextFromGates(colIndex, rowOffset);
    return outerContext === undefined ? local : new Map([...outerContext, ...local]);
}

/** Visits enabled gates in wire order, checking bounds before building their operations. */
function appendGateOperations(circuit, colIndex, rowOffset, time, context, structure) {
    // JSON omits trailing empty columns, which have no gate operations.
    const gates = circuit.columns[colIndex]?.gates ?? [];
    for (let row = 0; row < gates.length; row++) {
        const gate = gates[row];
        if (gate === undefined || circuit.gateAtLocIsDisabledReason(colIndex, row) !== undefined) {
            continue;
        }
        const at = rowOffset + row;
        if (at + gate.height > structure.wireCount) {
            return {ok: false, reason: "This step uses wires beyond the ones the state covers."};
        }
        const failure = appendAroundOperations(gate, at, structure);
        if (failure !== undefined) {
            return failure;
        }
        const operation = gateOperation(gate, at, structure.wireCount, time, context);
        if (operation?.ok === false) {
            return operation;
        }
        if (operation !== undefined) {
            structure.core.push(operation);
        }
    }
    return undefined;
}

/** Adds basis changes or reversed inputs around the core; rejects unsupported effects. */
function appendAroundOperations(gate, at, structure) {
    if (gate.customBeforeOperation === undefined && gate.customAfterOperation === undefined) {
        return undefined;
    }
    const {basisChanges, detectors} = gateTables();
    if (basisChanges.has(gate)) {
        const {setup, cleanup} = basisChanges.get(gate);
        if (setup !== undefined) {
            structure.setup.push({kind: 'single', wire: at, m: setup});
            structure.cleanup.unshift({kind: 'single', wire: at, m: cleanup});
        }
    } else if (/^revinput/.test(gate.serializedId)) {
        const positions = Array.from({length: gate.height}, (_, i) => gate.height - 1 - i);
        structure.setup.push({kind: 'bits', row: at, height: gate.height, positions});
        structure.cleanup.unshift({kind: 'bits', row: at, height: gate.height, positions});
    } else if (detectors.has(gate)) {
        return {ok: false, reason: `The ${gate.name} measures at random, so this step is ` +
            "not a linear operation and has no matrix."};
    } else {
        return {ok: false, reason: `The ${gate.name} acts around its column in a way ` +
            "that has no matrix."};
    }
    return undefined;
}

/** Selects a gate's representation, or returns its unsupported-effect reason. */
function gateOperation(gate, at, wireCount, time, context) {
    if (gate.isControl() || gate.isSwapHalf || gate.definitelyHasNoEffect()) {
        return undefined;
    }
    const {inputRotations} = gateTables();
    if (inputRotations.has(gate)) {
        return inputRotationOperation(gate, at, context, inputRotations.get(gate));
    }
    if (gate.knownPreparation !== undefined) {
        return preparationOperation(gate, at);
    }
    if (gate.knownPermutationFuncTakingInputs !== undefined) {
        return {kind: 'permutation', row: at, height: gate.height,
            func: gate.knownPermutationFuncTakingInputs, inputs: inputsFor(gate, context)};
    }
    if (gate.knownBitPermutationFunc !== undefined) {
        const positions = Array.from({length: gate.height}, (_, i) => gate.knownBitPermutationFunc(i));
        return {kind: 'bits', row: at, height: gate.height, positions};
    }
    const matrix = gate.height <= MAX_DENSE_BLOCK_QUBITS ? gate.knownMatrixAt(time) : undefined;
    if (matrix !== undefined) {
        return {kind: 'dense', row: at, height: gate.height, buffer: matrix.rawBuffer(), columns: []};
    }
    if (gate.knownCircuit !== undefined) {
        return nestedCircuitOperation(gate, at, wireCount, time, context);
    }
    return {ok: false, reason: gate.height > MAX_DENSE_BLOCK_QUBITS
        ? `The ${gate.name} over ${gate.height} qubits declares no permutation, and its matrix ` +
            "is too large to build from its definition."
        : `The ${gate.name} has no known effect that can be written as a matrix.`};
}

/** Resolves input A for a parametrized rotation and creates its matrix cache. */
function inputRotationOperation(gate, at, context, rotation) {
    const range = context.get('Input Range A');
    if (range === undefined) {
        return {ok: false, reason: `The ${gate.name} needs input A in its column.`};
    }
    return {kind: 'inputRotation', wire: at, ...rotation,
        input: {offset: range.offset, length: range.length, fallback: 0}, cache: new Map()};
}

/** Builds ψ⟨0…0| and counts its nonzero outputs for the fan-out estimate. */
function preparationOperation(gate, at) {
    const amplitudes = preparedStateVector(gate.knownPreparation, gate.height);
    let nonzero = 0;
    for (let v = 0; v < amplitudes.length; v += 2) {
        nonzero += amplitudes[v] !== 0 || amplitudes[v + 1] !== 0 ? 1 : 0;
    }
    return {kind: 'prepare', row: at, height: gate.height, amplitudes, nonzero};
}

/** Builds nested initial-state operations, then columns at their absolute offset. */
function nestedCircuitOperation(gate, at, wireCount, time, context) {
    const inner = gate.knownCircuit.withDisabledReasonsForEmbeddedContext(at, context);
    const initial = initialStateStructure(inner, at, wireCount, time);
    const structures = initial.core.length === 0 ? [] : [initial];
    for (let col = 0; col < inner.columns.length; col++) {
        const built = columnStructure(inner, col, wireCount, time, at, context);
        if (!built.ok) {
            return {ok: false, reason: `Inside the ${gate.name}: ${built.reason}`};
        }
        structures.push(built);
    }
    const fanOut = structures.reduce((product, built) => product * structureFanOut(built), 1);
    return {kind: 'nested', structures, fanOut: Math.min(fanOut, 1 << gate.height)};
}

/**
 * Mirrors CircuitExecution.applyInitialStateOperations using the same gate sequences.
 * This structure stays inside the nested operation, under the outer column's controls.
 * It is added once per nested circuit, never to each ordinary column.
 */
function initialStateStructure(circuit, rowOffset, wireCount, time) {
    const structure = emptyStructure(wireCount);
    for (let wire = 0; wire < circuit.numWires; wire++) {
        const state = circuit.customInitialValues.get(wire);
        const gates = INITIAL_STATES_TO_GATES.get(state);
        if (gates === undefined) {
            throw new Error(`Unrecognized initial state: ${state}`);
        }
        for (const gate of gates) {
            structure.core.push({kind: 'single', wire: rowOffset + wire, m: gate.knownMatrixAt(time).rawBuffer()});
        }
    }
    return structure;
}

/** A pair of swap halves is one operation under the column's controls. */
function appendSwapOperation(circuit, colIndex, rowOffset, structure) {
    const rows = circuit.colGetEnabledSwapGate(colIndex);
    if (rows !== undefined) {
        structure.core.push({kind: 'swap', a: rowOffset + rows[0], b: rowOffset + rows[1]});
    }
}

/** Folds parity after basis changes and unfolds it before their cleanup. */
function appendParityOperations(controls, structure) {
    if (controls.parityMask !== 0) {
        const target = Math.round(Math.log2(controls.parityMask & controls.inclusionMask));
        const fold = {kind: 'xorParity', target, mask: controls.parityMask & ~(1 << target)};
        structure.setup.push(fold);
        structure.cleanup.unshift(fold);
    }
}

export {columnStructure};
