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

import {Gate, GateBuilder} from "../../circuit/model/Gate.js"
import {CanvasTheme} from "../../config/CanvasTheme.js"
import {paintBackground, paintOutline, paintGateButton} from '../../draw/gate/GateFrame.js';
import {paintGateSymbol} from '../../draw/gate/GateSymbol.js';
import {ComplexFormula} from "../../engine/math/formula/ComplexFormula.js"
import {preparationMatrix} from "../../engine/math/preparedStates.js"
import {GateShaders} from "../../engine/simulation/gpu/GateShaders.js"
import {ketArgs, ketShader} from "../../engine/simulation/gpu/KetShaderUtil.js"
import {WglArg} from "../../engine/webgl/shader/WglArg.js"

/**
 * Prepare boxes: gates that start their wires in a state - a value, every value at once, a Bell
 * pair, GHZ, W, or amplitudes typed in - the way Qiskit's `initialize` does. A box goes at the
 * start of its wires; the wires may not have been acted on yet, nor started away from |0⟩ by a
 * ket, because the box takes |0…0⟩ to its state and discards anything else (the disabled reason
 * says so). Inside a custom gate the wires' history is unknown, so a box is refused there.
 *
 * Every box is the same rank-one operation ψ⟨0…0| on its wires. The families over many wires
 * compute ψ in a shader; a box of typed amplitudes is limited to four wires and applies its
 * matrix.
 */

/** Past this many wires a box of typed amplitudes has more amplitudes than anyone types in. */
const MAX_AMPLITUDE_WIRES = 4;
/** Up to this many wires a box's matrix is built for the hover card and the algebra view. */
const MAX_MATRIX_WIRES = 4;

const PrepareGates = {};

/**
 * @param {!GateCheckArgs} args
 * @returns {undefined|!string}
 */
function prepareDisabledReason(args) {
    if (args.isNested) {
        return "no\nprepare\nin custom\ngate";
    }
    const mask = ((1 << args.gate.height) - 1) << args.outerRow;
    if ((args.touchedMask & mask) !== 0) {
        return "wires\nalready\nset";
    }
    return undefined;
}

/**
 * @param {!Gate} gate A gate a parameter change produced, to declare its new preparation on.
 * @returns {!GateBuilder}
 */
function builderFor(gate) {
    const builder = new GateBuilder();
    builder.gate = gate;
    return builder;
}

/**
 * @param {!GateBuilder} builder
 * @param {!Preparation} preparation
 * @param {!int} span
 * @returns {!GateBuilder}
 */
function declarePreparation(builder, preparation, span) {
    return builder.
        setKnownEffectToPreparation(preparation, span <= MAX_MATRIX_WIRES ? preparationMatrix(preparation, span) : undefined).
        setExtraDisableReasonFinder(prepareDisabledReason);
}

/**
 * A shader taking a register's |0…0⟩ component to the state `body` computes an amplitude of, given
 * the register value `out_id`, and discarding the rest.
 *
 * @param {!string} head
 * @param {!string} body Sets `vec2 psi` for `out_id`.
 * @param {!int} span
 * @returns {!{withArgs: !function(...!WglArg): !WglConfiguredShader}}
 */
const prepareShader = (head, body, span) => ketShader(
    head,
    `
        vec2 psi;
        ${body}
        return cmul(inp(0.0), psi);
    `,
    span);

/**
 * The box's renderer: its symbol, or its value, and the button that edits a parameter.
 *
 * @param {!function(!Gate): !string} symbolOf
 * @param {!boolean} hasButton
 * @returns {!function(!GateRenderParams)}
 */
const prepareRenderer = (symbolOf, hasButton) => args => {
    paintBackground(args, args.isHighlighted ? CanvasTheme.gate.hover : CanvasTheme.surface.quiet);
    paintOutline(args);
    paintGateSymbol(args, symbolOf(args.gate), false);
    if (hasButton) {
        paintGateButton(args);
    }
};

// ---- |v⟩ ----------------------------------------------------------------------------------------

const VALUE_SHADERS = new Map();
const valueShader = span => {
    if (!VALUE_SHADERS.has(span)) {
        VALUE_SHADERS.set(span, prepareShader(
            `uniform float value;`,
            `psi = vec2(out_id == value ? 1.0 : 0.0, 0.0);`,
            span));
    }
    return VALUE_SHADERS.get(span);
};

/**
 * What a parameter decides - the preparation, its matrix, its operation - is built once per
 * parameter and shared: every parse of the circuit and every undo step re-parametrizes its boxes.
 *
 * @param {!Map} cache
 * @param {*} key
 * @param {!function(): *} build
 * @returns {*}
 */
function once(cache, key, build) {
    if (!cache.has(key)) {
        if (cache.size >= 256) {
            cache.clear();
        }
        cache.set(key, build());
    }
    return cache.get(key);
}

const VALUE_EFFECTS = new Map();

PrepareGates.ValueFamily = Gate.buildFamily(1, 16, (span, builder) => {
    // What a new value means for the gate: its preparation, its matrix while small, and its shader.
    const recompute = g => {
        const value = Number.isInteger(g.param) && g.param >= 0 && g.param < 1 << span ? g.param : 0;
        const {preparation, matrix, operation} = once(VALUE_EFFECTS, `${span}:${value}`, () => ({
            preparation: {kind: "value", value},
            matrix: span <= MAX_MATRIX_WIRES ? preparationMatrix({kind: "value", value}, span) : undefined,
            operation: ctx => ctx.applyOperation(
                valueShader(span).withArgs(...ketArgs(ctx, span), WglArg.float("value", value))),
        }));
        builderFor(g).setKnownEffectToPreparation(preparation, matrix).setExtraDisableReasonFinder(prepareDisabledReason);
        g.customOperation = operation;
    };
    builder.
    setSerializedId("Prep" + span).
    setSymbol("|v⟩").
    setTitle("Prepare Value").
    setBlurb("Starts its wires in the basis state |v⟩: each wire at its bit of v, the first wire lowest.\n" +
        "Click the box to set v. The wires must not have been acted on yet.").
    setRenderer(prepareRenderer(gate => `|${gate.param}⟩`, true)).
    setParamDialog({
        title: "Enter the value to prepare.",
        message: `A whole number from 0 to ${(1 << span) - 1}: the register reads it, the first wire as the lowest bit.`,
        applyText: (oldGate, text) => {
            const value = Number(text.trim());
            if (!Number.isInteger(value) || value < 0 || value >= 1 << span) {
                return {error: `'${text}' isn't a whole number from 0 to ${(1 << span) - 1}.`};
            }
            return {gate: oldGate.withParam(value)};
        },
    }).
    setWithParamPropertyRecomputeFunc(recompute);
    // The family keeps this gate, so it is parametrized in place rather than through withParam.
    builder.gate.param = 0;
    recompute(builder.gate);
});

// ---- |+…+⟩ --------------------------------------------------------------------------------------

PrepareGates.UniformFamily = Gate.buildFamily(1, 16, (span, builder) => declarePreparation(builder.
    setSerializedId("Prep+" + span).
    setSymbol(span <= 3 ? `|${"+".repeat(span)}⟩` : "|+…+⟩").
    setTitle("Prepare Uniform").
    setBlurb("Starts its wires with every value equally likely: |+⟩ on each wire, no entanglement.\n" +
        "The wires must not have been acted on yet.").
    setRenderer(prepareRenderer(gate => gate.symbol, false)).
    setActualEffectToShaderProvider(ctx => prepareShader(
        ``,
        `psi = vec2(${1 / Math.sqrt(1 << span)}, 0.0);`,
        span).withArgs(...ketArgs(ctx, span))),
    {kind: "named", name: "plus"}, span));

// ---- Bell and GHZ -------------------------------------------------------------------------------

const ghzShader = span => prepareShader(
    ``,
    `psi = (out_id == 0.0 || out_id == ${(1 << span) - 1}.0) ? vec2(${Math.SQRT1_2}, 0.0) : vec2(0.0, 0.0);`,
    span);

PrepareGates.Bell = declarePreparation(new GateBuilder().
    setSerializedId("PrepBell").
    setSymbol("|Φ⁺⟩").
    setTitle("Prepare Bell Pair").
    setBlurb("Starts its two wires as (|00⟩ + |11⟩)/√2: entangled, so they always agree, while each alone " +
        "is 50/50.\nThe wires must not have been acted on yet.").
    setHeight(2).
    setRenderer(prepareRenderer(gate => gate.symbol, false)).
    setActualEffectToShaderProvider(ctx => ghzShader(2).withArgs(...ketArgs(ctx, 2))),
    {kind: "named", name: "bell"}, 2).gate;

PrepareGates.GhzFamily = Gate.buildFamily(2, 16, (span, builder) => declarePreparation(builder.
    setSerializedId("PrepGHZ" + span).
    setSymbol("GHZ").
    setTitle("Prepare GHZ").
    setBlurb("Starts its wires as (|0…0⟩ + |1…1⟩)/√2: all zero or all one, together.\n" +
        "Over two wires that is a Bell pair. The wires must not have been acted on yet.").
    setRenderer(prepareRenderer(gate => gate.symbol, false)).
    setActualEffectToShaderProvider(ctx => ghzShader(span).withArgs(...ketArgs(ctx, span))),
    {kind: "named", name: "ghz"}, span));

// ---- W ------------------------------------------------------------------------------------------

PrepareGates.WFamily = Gate.buildFamily(2, 16, (span, builder) => declarePreparation(builder.
    setSerializedId("PrepW" + span).
    setSymbol("W").
    setTitle("Prepare W").
    setBlurb("Starts its wires with exactly one of them 1, each equally likely: entangled.\n" +
        "The wires must not have been acted on yet.").
    setRenderer(prepareRenderer(gate => gate.symbol, false)).
    setActualEffectToShaderProvider(ctx => prepareShader(
        ``,
        `
            float ones = 0.0;
            float v = out_id;
            for (int i = 0; i < ${span}; i++) {
                ones += mod(v, 2.0);
                v = floor(v / 2.0);
            }
            psi = ones == 1.0 ? vec2(${1 / Math.sqrt(span)}, 0.0) : vec2(0.0, 0.0);
        `,
        span).withArgs(...ketArgs(ctx, span))),
    {kind: "named", name: "w"}, span));

// ---- |ψ⟩ ----------------------------------------------------------------------------------------

/**
 * @param {!string} text Amplitudes separated by commas, one per basis state, in any formula the
 *     app reads: "1, i", "0.6, 0, 0, 0.8i", "1/sqrt(2), -1/sqrt(2)".
 * @param {!int} span
 * @returns {!{amplitudes: !Array.<!Array.<!number>>}|!{error: !string}}
 */
function parseAmplitudes(text, span) {
    const parts = text.split(",").map(e => e.trim());
    const size = 1 << span;
    if (parts.length !== size) {
        return {error: `${size} amplitudes are needed, one per basis state; got ${parts.length}.`};
    }
    const amplitudes = [];
    for (const part of parts) {
        let value;
        try {
            value = ComplexFormula.parse(part === "" ? "0" : part);
        } catch {
            return {error: `'${part}' isn't a number.`};
        }
        if (!Number.isFinite(value.real) || !Number.isFinite(value.imag)) {
            return {error: `'${part}' isn't a number.`};
        }
        amplitudes.push([value.real, value.imag]);
    }
    const norm = Math.sqrt(amplitudes.reduce((sum, [re, im]) => sum + re * re + im * im, 0));
    if (norm === 0) {
        return {error: "At least one amplitude must be nonzero."};
    }
    return {amplitudes: amplitudes.map(([re, im]) => [re / norm, im / norm])};
}

/**
 * @param {*} param
 * @param {!int} span
 * @returns {!Preparation} The param as a preparation, or |0…0⟩ when it is not one.
 */
function amplitudesPreparation(param, span) {
    const size = 1 << span;
    const ok = Array.isArray(param) && param.length === size &&
        param.every(e => Array.isArray(e) && e.length === 2 && e.every(Number.isFinite));
    if (!ok) {
        return {kind: "value", value: 0};
    }
    return {kind: "amplitudes", amplitudes: param.map(([re, im]) => [re, im])};
}

const AMPLITUDE_EFFECTS = new Map();

PrepareGates.AmplitudesFamily = Gate.buildFamily(1, MAX_AMPLITUDE_WIRES, (span, builder) => {
    const recompute = g => {
        const parsed = amplitudesPreparation(g.param, span);
        const {preparation, matrix, operation} = once(AMPLITUDE_EFFECTS, JSON.stringify(parsed), () => {
            const built = preparationMatrix(parsed, span);
            return {preparation: parsed, matrix: built, operation: ctx => GateShaders.applyMatrixOperation(ctx, built)};
        });
        builderFor(g).setKnownEffectToPreparation(preparation, matrix).setExtraDisableReasonFinder(prepareDisabledReason);
        g.customOperation = operation;
    };
    builder.
    setSerializedId("PrepPsi" + span).
    setSymbol("|ψ⟩").
    setTitle("Prepare State").
    setBlurb("Starts its wires in a state typed in as amplitudes, one per basis state, scaled to unit length.\n" +
        "Click the box to enter them. The wires must not have been acted on yet.").
    setRenderer(prepareRenderer(gate => gate.symbol, true)).
    setParamDialog({
        title: "Enter the amplitudes to prepare.",
        message: `${1 << span} amplitudes separated by commas, one per basis state from |${"0".repeat(span)}⟩ ` +
            `up, the first wire as the lowest bit. Formulas such as 1/sqrt(2) and -i work.`,
        applyText: (oldGate, text) => {
            const parsed = parseAmplitudes(text, span);
            return parsed.error !== undefined ? parsed : {gate: oldGate.withParam(parsed.amplitudes)};
        },
    }).
    setWithParamPropertyRecomputeFunc(recompute);
    builder.gate.param = Array.from({length: 1 << span}, (_, i) => [i === 0 ? 1 : 0, 0]);
    recompute(builder.gate);
});

PrepareGates.all = [
    ...PrepareGates.ValueFamily.all,
    ...PrepareGates.UniformFamily.all,
    PrepareGates.Bell,
    ...PrepareGates.GhzFamily.all,
    ...PrepareGates.WFamily.all,
    ...PrepareGates.AmplitudesFamily.all,
];

export {PrepareGates, parseAmplitudes, MAX_AMPLITUDE_WIRES}
