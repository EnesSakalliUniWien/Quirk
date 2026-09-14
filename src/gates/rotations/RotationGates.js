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

import {GateBuilder} from "../../circuit/model/Gate.js"
import {paintBackground, paintOutline, paintGateButton} from '../../draw/gate/GateFrame.js';
import {parseAngleExpression} from '../../engine/math/formula/AngleExpression.js';
import {paintAngleGateLabel} from '../../draw/gate/AngleGateLabel.js';
import {XExp, YExp, ZExp} from "./ExponentiatingGates.js"
import {parseTimeFormula, makeUpdateFormulaFunc} from "./FormulaGateUtil.js"

const RotationGates = {};

/**
 * @param {undefined|!string|!number} param
 * @returns {!number}
 */
function angleInRadians(param) {
    if (typeof param === 'number') {
        return param;
    }
    return parseTimeFormula(param, undefined, false) || 0;
}

/**
 * @param {!string} axisName
 * @returns {!function(args: !GateRenderParams)}
 */
function angleRotationRenderer(axisName) {
    // The label states the exact angle; the animation clock the time-varying gates paint
    // (paintCycleState) is meaningless for a constant angle and only obscured the label.
    return args => {
        paintBackground(args);
        paintOutline(args);
        paintAngleGateLabel(args);
        paintGateButton(args);
    };
}

/**
 * @param {!GateCheckArgs} args
 * @returns {undefined|!string}
 */
function badAngleFormulaDetector(args) {
    if (typeof args.gate.param === 'number') {
        return undefined;
    } else if (typeof args.gate.param === 'string') {
        return parseTimeFormula(args.gate.param, undefined, false) === undefined ? 'bad\nangle' : undefined;
    } else {
        return 'bad\nvalue';
    }
}

/**
 * @param {!string} axisName
 * @returns {!{title: !string, message: !string, applyText: !function(!Gate, !string): !{gate: !Gate}}}
 */
function radianAngleDialog(axisName) {
    return {
        title: `${axisName} angle`,
        angleUnit: 'radians',
        message: "The angle can be a constant formula (e.g. pi/2 or 3pi/4).\n" +
            "\n" +
            "Available constants: e, pi\n" +
            "Available functions: cos, sin, acos, asin, tan, atan, ln, sqrt, exp\n" +
            "Available operators: + * / - ^",
        applyText: (oldGate, text) => {
            if (text.trim() === '' || text === oldGate.param) return {gate: oldGate};
            try { parseAngleExpression(text); } catch (error) { return {error: error.message}; }
            return {gate: oldGate.withParam(text)};
        }
    };
}

// The angle must be constant, so a t-dependent formula never counts as time-dependent here; the
// disable-reason finder flags it instead.
const updateUsingAngleFormula = makeUpdateFormulaFunc(5, false);

RotationGates.Rx = new GateBuilder().
    setSerializedIdAndSymbol("Rx").
    setTitle("Rx Gate").
    setBlurb("Rotates the target around the X axis by an adjustable angle given in radians.\n" +
        "Click the gate to change the angle.").
    setRenderer(angleRotationRenderer('Rx')).
    setWidth(2).
    setExtraDisableReasonFinder(badAngleFormulaDetector).
    setParamDialog(radianAngleDialog('Rx')).
    setEffectToTimeVaryingMatrix((t, angle) => XExp(angleInRadians(angle) / Math.PI / 4)).
    setWithParamPropertyRecomputeFunc(updateUsingAngleFormula).
    promiseEffectIsUnitary().
    gate.withParam('pi/2');

RotationGates.Ry = new GateBuilder().
    setSerializedIdAndSymbol("Ry").
    setTitle("Ry Gate").
    setBlurb("Rotates the target around the Y axis by an adjustable angle given in radians.\n" +
        "Click the gate to change the angle.").
    setRenderer(angleRotationRenderer('Ry')).
    setWidth(2).
    setExtraDisableReasonFinder(badAngleFormulaDetector).
    setParamDialog(radianAngleDialog('Ry')).
    setEffectToTimeVaryingMatrix((t, angle) => YExp(angleInRadians(angle) / Math.PI / 4)).
    setWithParamPropertyRecomputeFunc(updateUsingAngleFormula).
    promiseEffectIsUnitary().
    gate.withParam('pi/2');

RotationGates.Rz = new GateBuilder().
    setSerializedIdAndSymbol("Rz").
    setTitle("Rz Gate").
    setBlurb("Rotates the target around the Z axis by an adjustable angle given in radians.\n" +
        "Click the gate to change the angle.").
    setRenderer(angleRotationRenderer('Rz')).
    setWidth(2).
    setExtraDisableReasonFinder(badAngleFormulaDetector).
    setParamDialog(radianAngleDialog('Rz')).
    setEffectToTimeVaryingMatrix((t, angle) => ZExp(angleInRadians(angle) / Math.PI / 4)).
    setWithParamPropertyRecomputeFunc(updateUsingAngleFormula).
    promiseEffectOnlyPhases().
    gate.withParam('pi/2');

RotationGates.all = [
    RotationGates.Rx,
    RotationGates.Ry,
    RotationGates.Rz,
];

export {RotationGates}
