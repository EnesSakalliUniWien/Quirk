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

import {GateBuilder} from "../../circuit/Gate.js"
import {GatePainting} from "../../draw/GatePainting.js"
import {XExp, YExp, ZExp} from "./ExponentiatingGates.js"
import {parseTimeFormula, makeUpdateFormulaFunc} from "./FormulaGateUtil.js"

let RotationGates = {};

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
 * @param {!int} xyz
 * @returns {!function(args: !GateDrawParams)}
 */
function angleRotationDrawer(axisName, xyz) {
    let xScale = [1, 0.5, -1][xyz];
    let yScale = [1, 1, -0.5][xyz];
    return args => {
        GatePainting.paintBackground(args);
        GatePainting.paintOutline(args);
        GatePainting.paintGateSymbol(args, `${axisName}(${args.gate.param})`, false);
        GatePainting.paintGateButton(args);
        GatePainting.paintCycleState(args, angleInRadians(args.gate.param), xScale, yScale);
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
        title: `Enter an angle in radians for the ${axisName} gate's rotation.`,
        message: "The angle can be a constant formula (e.g. pi/2 or 3pi/4).\n" +
            "Invalid results will default to 0.\n" +
            "\n" +
            "Available constants: e, pi\n" +
            "Available functions: cos, sin, acos, asin, tan, atan, ln, sqrt, exp\n" +
            "Available operators: + * / - ^",
        applyText: (oldGate, text) =>
            ({gate: text.trim() === '' ? oldGate : oldGate.withParam(text)})
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
    setDrawer(angleRotationDrawer('Rx', 0)).
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
    setDrawer(angleRotationDrawer('Ry', 1)).
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
    setDrawer(angleRotationDrawer('Rz', 2)).
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
