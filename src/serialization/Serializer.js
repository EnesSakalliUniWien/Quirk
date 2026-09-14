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

import {CircuitDefinition} from "../circuit/model/CircuitDefinition.js"
import {Complex} from "../engine/math/complex/Complex.js"
import {Simulation} from "../config/Simulation.js"
import {CustomGateSet} from "../circuit/model/CustomGateSet.js"
import {describe} from "../base/Describe.js"
import {DetailedError} from "../base/DetailedError.js"
import {Format} from "../base/Format.js"
import {Gate, GateBuilder} from "../circuit/model/Gate.js"
import {GateColumn} from "../circuit/model/GateColumn.js"
import {Gates} from "../gates/AllGates.js"
import {INITIAL_STATE_KEYS} from "../circuit/model/InitialStates.js"
import {Registers} from "../circuit/model/Registers.js"
import {Matrix} from "../engine/math/matrix/Matrix.js"
import {Util} from "../base/Util.js"
import {reportRecoveredError} from "../diagnostics/errorReporter.js"
import {MysteryGateSymbol, MysteryGateMakerWithMatrix} from "../gates/misc/Joke_MysteryGate.js"
import {setGateBuilderEffectToCircuit} from "../engine/simulation/CircuitComputeUtil.js"
import {MATRIX_RENDERER, LABEL_RENDERER, LOCATION_INDEPENDENT_GATE_RENDERER} from '../draw/gate/GateRenderers.js';
import {renderCustomGateCircuit} from "../draw/gate/CustomGateCircuitRenderer.js"
import {ComplexFormula} from "../engine/math/formula/ComplexFormula.js"

/**
 * Serializes supported values to/from json elements.
 */
class Serializer {
    /**
     * @param {*} value
     * @param {*=undefined} context
     * @returns {*}
     */
    static toJson(value, context=undefined) {
        for (const [type, toJ, _] of BINDINGS) {
            if (value instanceof type) {
                return toJ(value, context);
            }
        }
        throw new Error(`Don't know how to convert ${describe(value)} to JSON.`);
    }

    /**
     * @param {*} expectedType
     * @param {*} json
     * @param {*=undefined} context
     * @returns {*}
     */
    static fromJson(expectedType, json, context=undefined) {
        for (const [type, _, fromJ] of BINDINGS) {
            if (type === expectedType) {
                return fromJ(json, context);
            }
        }
        throw new Error(`Don't know how to deserialize JSON ${describe(json)} into an instance of ${expectedType}.`);
    }
}

/**
 * @param {!Complex} v
 * @returns {!object}
 */
const toJson_Complex = v => v.toString(Format.MINIFIED);

/**
 * @param {object} json
 * @returns {!Complex}
 * @throws {Error}
 */
const fromJson_Complex = json => {
    if (typeof json === "string") {
        return ComplexFormula.parse(json);
    }
    throw new Error("Not a packed complex string: " + json);
};

/**
 * @param {!Matrix} v
 * @returns {!object}
 */
const toJson_Matrix = v => v.toString(Format.MINIFIED);

/**
 * @param {object} json
 * @returns {!Matrix}
 * @throws {Error}
 */
const fromJson_Matrix = json => {
    if (typeof json !== "string") {
        throw new Error("Not a packed matrix string: " + json);
    }
    return Matrix.parse(/** @type {!string} */ json);
};

/**
 * @param {!Gate} gate
 * @param {!CustomGateSet=} context
 * @returns {!object}
 */
const toJson_Gate = (gate, context=new CustomGateSet()) => {
    const found = Gates.findKnownGateById(gate.serializedId, context);
    if (found === gate) {
        return gate.serializedId;
    }
    if (found !== undefined && found.param !== undefined) {
        return {id: gate.serializedId, arg: gate.param};
    }

    if (gate.name === "Parse Error") {
        return gate.tag;
    }

    const result = {};
    if (gate.serializedId !== "") {
        result.id = gate.serializedId;
    }
    if (gate.serializedId.startsWith("~") ? gate.symbol !== '' : gate.symbol !== gate.serializedId) {
        result.name = gate.symbol;
    }

    if (gate.stableDuration() === Infinity && gate.knownMatrixAt(0) !== undefined) {
        result.matrix = toJson_Matrix(gate.knownMatrixAt(0.25));
    } else if (gate.knownCircuit !== undefined) {
        result.circuit = toJson_CircuitDefinition(gate.knownCircuit, context);
    } else {
        throw new DetailedError("Don't known how to serialize gate's function.", {gate});
    }

    return result;
};

/**
 * @param {*} json
 * @returns {!String}
 * @private
 */
function _getGateId(json) {
    const symbol = typeof json === "string" ? json : json["id"];

    // Recover from bad symbol.
    if (symbol === undefined) {
        return "";
    }
    if (typeof symbol !== "string") {
        return describe(symbol);
    }

    return symbol;
}

/**
 * @param {*} matrixProp
 * @returns {!Matrix}
 * @private
 * @throws
 */
function _parseGateMatrix(matrixProp) {
    if (matrixProp === undefined) {
        throw new Error("Unrecognized gate id, but no matrix specified.");
    }
    const matrix = fromJson_Matrix(matrixProp);
    if (matrix.width() !== matrix.height()) {
        throw new Error("Gate matrix must be square.");
    }
    if (matrix.width() < 2 || matrix.width() > 1 << 4 || !Util.isPowerOf2(matrix.width())) {
        throw new Error("Supported gate matrix sizes are 2, 4, 8, and 16.");
    }
    return matrix;
}

/**
 * @param {object} json
 * @returns {!{id: !String, matrix: *, circuit: *, symbol: *, name: *, param: *}}
 */
const fromJson_Gate_props = json => {
    const id = _getGateId(json);
    const matrix = json["matrix"];
    const circuit = json["circuit"];
    const param = json["arg"];
    const symbol = json.name !== undefined ? json.name :
        id.startsWith('~') ? '' :
        id;
    const name = id.startsWith('~') ? `${symbol || 'Custom'} Gate [${id.slice(1)}]` :
        symbol !== '' ? symbol :
        id;
    return {id, matrix, circuit, symbol, name, param};
};

/**
 * @param {!{id: !String, matrix: *, circuit: *, symbol: *, name: *, param: *}} props
 * @returns {!Gate}
 */
const fromJson_Gate_Matrix = props => {
    const mat = _parseGateMatrix(props.matrix);

    // Special case the mystery gate.
    if (props.id === MysteryGateSymbol) {
        return MysteryGateMakerWithMatrix(mat);
    }

    const height = Math.round(Math.log2(mat.height()));
    const width = props.symbol === '' ? height : 1;
    const matrix = _parseGateMatrix(props.matrix);

    const builder = new GateBuilder().
        setSerializedId(props.id).
        setSymbol(props.symbol).
        setTitle(props.name).
        setHeight(height).
        setWidth(width).
        setRenderer(props.symbol === "" ? MATRIX_RENDERER
            : matrix.isIdentity() ? LABEL_RENDERER
            : matrix.isScaler() ? LOCATION_INDEPENDENT_GATE_RENDERER
            : undefined).
        setKnownEffectToMatrix(matrix);
    if (matrix.isIdentity()) {
        builder.markAsNotInterestedInControls();
    }
    return builder.gate;
};

/**
 * @param {!{id: !String, matrix: *, circuit: *, symbol: *, name: *, param: *}} props
 * @param {undefined|!CustomGateSet} context
 * @returns {!Gate}
 */
const fromJson_Gate_Circuit = (props, context) => {
    const circuit = fromJson_CircuitDefinition(props.circuit, context).withMinimumWireCount();
    return setGateBuilderEffectToCircuit(new GateBuilder(), circuit).
        setSerializedId(props.id).
        setSymbol(props.symbol).
        setTitle(props.name).
        setRenderer(renderCustomGateCircuit).
        gate;
};

/**
 * @param {!object} json
 * @param {!CustomGateSet=} context
 * @returns {!Gate}
 * @throws {Error}
 */
const fromJson_Gate = (json, context=new CustomGateSet()) => {
    const props = fromJson_Gate_props(json);

    try {
        if (props.matrix !== undefined) {
            return fromJson_Gate_Matrix(props);
        }

        if (props.circuit !== undefined) {
            return fromJson_Gate_Circuit(props, context);
        }

        // Operation not provided. Try to match by id.
        let match = Gates.findKnownGateById(props.id, context);
        if (match === undefined) {
            throw new DetailedError(`No gate with the id '${props.id}'.`, {json});
        }
        if (props.param !== undefined) {
            if (match.param === undefined) {
                throw new DetailedError("Arg for gate without arg.", {json});
            }
            match = match.withParam(props.param);
        }
        return match;

    } catch (ex) {
        reportRecoveredError(
            "Defaulted to a do-nothing 'parse error' gate. Failed to understand the json defining a gate.",
            {gate_json: json},
            ex);
        return new GateBuilder().
            setSerializedIdAndSymbol(props.id).
            setTitle("Parse Error").
            setBlurb(describe(ex)).
            promiseHasNoNetEffectOnStateVector().
            setExtraDisableReasonFinder(() => "parse\nerror").
            setTag(json).
            gate;
    }
};

/**
 * @param {!GateColumn} v
 * @param {!CustomGateSet=} context
 * @returns {!object}
 */
function toJson_GateColumn(v, context=new CustomGateSet()) {
    return v.gates.map(e => e === undefined ? 1 : toJson_Gate(e, context));
}

/**
 * @param {object} json
 * @param {!CustomGateSet=} context
 * @returns {!GateColumn}
 * @throws
 */
const fromJson_GateColumn = (json, context=new CustomGateSet()) => {
    if (!Array.isArray(json)) {
        throw new Error(`GateColumn json should be an array. Json: ${describe(json)}`);
    }
    return new GateColumn(json.map(e => e === 1 || e === undefined ? undefined : fromJson_Gate(e, context)));
};

/**
 * @param {!CustomGateSet} v
 * @returns {*}
 */
function toJson_CustomGateSet(v) {
    const result = [];
    for (let i = 0; i < v.gates.length; i++) {
        result.push(toJson_Gate(v.gates[i], new CustomGateSet(...v.gates.slice(0, i))));
    }
    return result;
}

/**
 * @param {*} json
 * @returns {!CustomGateSet}
 */
function fromJson_CustomGateSet(json) {
    if (!Array.isArray(json)) {
        throw new DetailedError("Expected an array of gates.", {json});
    }
    let gatesSoFar = new CustomGateSet();
    for (const e of json) {
        gatesSoFar = gatesSoFar.withGate(fromJson_Gate(e, gatesSoFar));
    }
    return gatesSoFar;
}

/**
 * @param {!CircuitDefinition} v
 * @param {undefined|!CustomGateSet} context
 * @returns {!object}
 */
const toJson_CircuitDefinition = (v, context) => {
    const result = {
        cols: v.trimEmptyColumnsAtEndIgnoringGateWidths().columns.
            map(e => toJson_GateColumn(e, context || v.customGateSet)).
            map(c => {
                // Trailing 1s are the default gate weight, so the JSON leaves them out.
                let end = c.length;
                while (end > 0 && c[end - 1] === 1) {
                    end -= 1;
                }
                return c.slice(0, end);
            })
    };
    if (context === undefined && v.customGateSet.gates.length > 0) {
        result.gates = toJson_CustomGateSet(v.customGateSet);
    }
    if (v.customInitialValues.size > 0) {
        result.init = [];
        const maxInit = Math.max(...v.customInitialValues.keys());
        for (let i = 0; i <= maxInit; i++) {
            const s = v.customInitialValues.get(i);
            result.init.push(
                s === undefined ? 0 :
                s === '1' ? 1 :
                s);
        }
    }
    if (!v.registers.isEmpty()) {
        result.registers = v.registers.list.map(toJson_Register);
    }
    return result;
};

/**
 * A register as JSON: its name, its wires as [first, count], the input it feeds when it feeds one,
 * and the labels of its values when it has any.
 *
 * @param {!Register} register
 * @returns {!object}
 */
function toJson_Register(register) {
    const result = {name: register.name, wires: [register.start, register.length]};
    if (register.input !== undefined) {
        result.input = register.input;
    }
    if (register.labels !== undefined) {
        result.labels = {...register.labels};
    }
    return result;
}

/**
 * @param {object} json
 * @returns {!Registers}
 * @throws
 */
function _fromJson_Registers(json) {
    const {registers} = json;
    if (registers === undefined) {
        return Registers.EMPTY;
    }
    if (!Array.isArray(registers)) {
        throw new DetailedError('Registers must be an array.', {json});
    }
    const list = registers.map(e => {
        if (e === null || typeof e !== 'object' || !Array.isArray(e.wires) || e.wires.length !== 2) {
            throw new DetailedError('A register needs a name and its wires as [first, count].', {register: e});
        }
        return {name: e.name, start: e.wires[0], length: e.wires[1], input: e.input, labels: e.labels};
    });
    const problem = Registers.problemWith(list);
    if (problem !== undefined) {
        throw new DetailedError(problem, {registers});
    }
    return new Registers(list);
}

let _cachedCircuit = undefined;
let _cachedCircuit_Arg = undefined;
function fromJsonText_CircuitDefinition(jsonText) {
    if (_cachedCircuit_Arg === jsonText) {
        return _cachedCircuit;
    }
    _cachedCircuit_Arg = jsonText;
    _cachedCircuit = fromJson_CircuitDefinition(JSON.parse(jsonText), undefined);
    return _cachedCircuit;
}

/**
 * @param {object} json
 * @returns {!Map.<!int, !string>}
 * @throws
 */
function _fromJson_InitialState(json) {
    const {init} = json;
    if (init === undefined) {
        return new Map();
    }

    if (!Array.isArray(init)) {
        throw new DetailedError('Initial states must be an array.', {json});
    }

    const result = new Map();
    for (let i = 0; i < init.length; i++) {
        const v = init[i];
        if (v === 0) {
            // 0 is the default. Don't need to do anything.
        } else if (v === 1) {
            result.set(i, '1');
        } else if (INITIAL_STATE_KEYS.includes(v)) {
            result.set(i, v);
        } else {
            throw new DetailedError('Unrecognized initial state key.', {v, json});
        }
    }

    return result;
}

/**
 * @param {object} json
 * @param {undefined|!CustomGateSet} context
 * @returns {!CircuitDefinition}
 * @throws
 */
function fromJson_CircuitDefinition(json, context=undefined) {
    const {cols} = json;
    const customGateSet = context ||
        (json.gates === undefined ? new CustomGateSet() : fromJson_CustomGateSet(json.gates));

    if (!Array.isArray(cols)) {
        throw new Error(`CircuitDefinition json should contain an array of cols. Json: ${describe(json)}`);
    }
    let gateCols = cols.map(e => fromJson_GateColumn(e, customGateSet));

    const initialValues = _fromJson_InitialState(json);
    const registers = _fromJson_Registers(json);

    let numWires = 0;
    for (const col of gateCols) {
        numWires = Math.max(numWires, col.minimumRequiredWireCount());
    }
    numWires = Math.max(
        Simulation.MIN_WIRE_COUNT,
        Math.min(numWires, Simulation.MAX_WIRE_COUNT),
        registers.minimumRequiredWireCount(),
        ...[...initialValues.keys()].map(e => e + 1));

    gateCols = gateCols.map(col => new GateColumn([
            ...col.gates,
            // Pad column up to circuit length.
            ...new Array(Math.max(0, numWires - col.gates.length)).fill(undefined)
        // Silently discard gates off the edge of the circuit.
        ].slice(0, numWires)));

    return new CircuitDefinition(numWires, gateCols, undefined, undefined, customGateSet, false, initialValues,
        registers).
        withTrailingSpacersIncluded();
}

const BINDINGS = [
    [Complex, toJson_Complex, fromJson_Complex],
    [Gate, toJson_Gate, fromJson_Gate],
    [Matrix, toJson_Matrix, fromJson_Matrix],
    [GateColumn, toJson_GateColumn, fromJson_GateColumn],
    [CircuitDefinition, toJson_CircuitDefinition, fromJson_CircuitDefinition]
];

export {Serializer, fromJsonText_CircuitDefinition}
