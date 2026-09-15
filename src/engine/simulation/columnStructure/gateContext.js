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

import {INPUT_LETTERS} from "../../../circuit/model/InputLetters.js";
import {Controls} from "../../../gates/probes/Controls.js";
import {Detectors} from "../../../gates/probes/Detector.js";
import {HalfTurnGates} from "../../../gates/rotations/HalfTurnGates.js";
import {ParametrizedRotationGates} from "../../../gates/rotations/ParametrizedRotationGates.js";
import {QuarterTurnGates} from "../../../gates/rotations/QuarterTurnGates.js";

/** @typedef {import("../../../circuit/model/Gate.js").Gate} Gate */

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

export {gateTables, inputsFor};
