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
import {GatePainting} from "../../draw/gate/GatePainting.js"
import {Matrix} from "../../engine/math/matrix/Matrix.js"

const PoweringGates = {};

const τ = Math.PI * 2;
const XPow = t => {
    const c = Math.cos(τ * t) / 2;
    const s = Math.sin(τ * t) / 2;
    return new Matrix(2, 2, new Float32Array([0.5+c, s, 0.5-c, -s, 0.5-c, -s, 0.5+c, s]));
};
const YPow = t => {
    const c = Math.cos(τ * t) / 2;
    const s = Math.sin(τ * t) / 2;
    return new Matrix(2, 2, new Float32Array([0.5+c, s, -s, c-0.5, s, 0.5-c, 0.5+c, s]));
};
const ZPow = t => {
    const c = Math.cos(τ * t);
    const s = Math.sin(τ * t);
    return new Matrix(2, 2, new Float32Array([1, 0, 0, 0, 0, 0, c, s]));
};

PoweringGates.XForward = new GateBuilder().
    setSerializedIdAndSymbol("X^t").
    setTitle("X-Raising Gate (forward)").
    setBlurb("Right-handed cycle from no-op to X.").
    setRenderer(GatePainting.makeCycleRenderer(1, 1)).
    setEffectToTimeVaryingMatrix(XPow).
    promiseEffectIsUnitary().
    gate;

PoweringGates.XBackward = new GateBuilder().
    setAlternate(PoweringGates.XForward).
    setSerializedIdAndSymbol("X^-t").
    setTitle("X-Raising Gate (backward)").
    setBlurb("Left-handed cycle from no-op to X.").
    setRenderer(GatePainting.makeCycleRenderer(-1, 1)).
    setEffectToTimeVaryingMatrix(t => XPow(-t)).
    promiseEffectIsUnitary().
    gate;

PoweringGates.YForward = new GateBuilder().
    setSerializedIdAndSymbol("Y^t").
    setTitle("Y-Raising Gate (forward)").
    setBlurb("Right-handed cycle from no-op to Y.").
    setRenderer(GatePainting.makeCycleRenderer(0.5, 1)).
    setEffectToTimeVaryingMatrix(YPow).
    promiseEffectIsUnitary().
    gate;

PoweringGates.YBackward = new GateBuilder().
    setAlternate(PoweringGates.YForward).
    setSerializedIdAndSymbol("Y^-t").
    setTitle("Y-Raising Gate (backward)").
    setBlurb("Left-handed cycle from no-op to Y.").
    setRenderer(GatePainting.makeCycleRenderer(-0.5, 1)).
    setEffectToTimeVaryingMatrix(t => YPow(-t)).
    promiseEffectIsUnitary().
    gate;

PoweringGates.ZForward = new GateBuilder().
    setSerializedIdAndSymbol("Z^t").
    setTitle("Z-Raising Gate (forward)").
    setBlurb("Right-handed cycle from no-op to Z.").
    setRenderer(GatePainting.makeCycleRenderer(-1, -0.5)).
    setEffectToTimeVaryingMatrix(ZPow).
    promiseEffectOnlyPhases().
    gate;

PoweringGates.ZBackward = new GateBuilder().
    setAlternate(PoweringGates.ZForward).
    setSerializedIdAndSymbol("Z^-t").
    setTitle("Z-Raising Gate (backward)").
    setBlurb("Left-handed cycle from no-op to Z.").
    setRenderer(GatePainting.makeCycleRenderer(1, -0.5)).
    setEffectToTimeVaryingMatrix(t => ZPow(-t)).
    promiseEffectOnlyPhases().
    gate;

PoweringGates.all = [
    PoweringGates.XForward,
    PoweringGates.YForward,
    PoweringGates.ZForward,
    PoweringGates.XBackward,
    PoweringGates.YBackward,
    PoweringGates.ZBackward
];

export {PoweringGates}
