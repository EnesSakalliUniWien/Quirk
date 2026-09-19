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
import {makeCycleRenderer} from '../../draw/gate/GateRenderers.js';
import {DIAL_AXIS} from '../../draw/gate/TimeDial.js';
import {Matrix} from "../../engine/math/matrix/Matrix.js"

const PoweringGates = {};

const τ = Math.PI * 2;

// One turnsAt per gate, set on the gate itself: how far round its cycle it has come at a time, in
// turns. Its matrix is built from that number (setEffectFromTurns) and its dial is drawn from it, so
// the two can never drift apart. A backward gate turns the other way, which is its negative sign.
const FORWARD = t => t;
const BACKWARD = t => -t;
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
    setTurnsAt(FORWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.X)).
    setEffectFromTurns(XPow).
    promiseEffectIsUnitary().
    gate;

PoweringGates.XBackward = new GateBuilder().
    setAlternate(PoweringGates.XForward).
    setSerializedIdAndSymbol("X^-t").
    setTitle("X-Raising Gate (backward)").
    setBlurb("Left-handed cycle from no-op to X.").
    setTurnsAt(BACKWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.X)).
    setEffectFromTurns(XPow).
    promiseEffectIsUnitary().
    gate;

PoweringGates.YForward = new GateBuilder().
    setSerializedIdAndSymbol("Y^t").
    setTitle("Y-Raising Gate (forward)").
    setBlurb("Right-handed cycle from no-op to Y.").
    setTurnsAt(FORWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.Y)).
    setEffectFromTurns(YPow).
    promiseEffectIsUnitary().
    gate;

PoweringGates.YBackward = new GateBuilder().
    setAlternate(PoweringGates.YForward).
    setSerializedIdAndSymbol("Y^-t").
    setTitle("Y-Raising Gate (backward)").
    setBlurb("Left-handed cycle from no-op to Y.").
    setTurnsAt(BACKWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.Y)).
    setEffectFromTurns(YPow).
    promiseEffectIsUnitary().
    gate;

PoweringGates.ZForward = new GateBuilder().
    setSerializedIdAndSymbol("Z^t").
    setTitle("Z-Raising Gate (forward)").
    setBlurb("Right-handed cycle from no-op to Z.").
    setTurnsAt(FORWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.Z)).
    setEffectFromTurns(ZPow).
    promiseEffectOnlyPhases().
    gate;

PoweringGates.ZBackward = new GateBuilder().
    setAlternate(PoweringGates.ZForward).
    setSerializedIdAndSymbol("Z^-t").
    setTitle("Z-Raising Gate (backward)").
    setBlurb("Left-handed cycle from no-op to Z.").
    setTurnsAt(BACKWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.Z)).
    setEffectFromTurns(ZPow).
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
