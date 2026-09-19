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

const ExponentiatingGates = {};

const τ = Math.PI * 2;

// One turnsAt per gate, set on the gate itself and read by its matrix (setEffectFromTurns) and its
// dial alike. These gates pass through ±i times their Pauli rather than the Pauli itself, so they
// come round twice over the cycle, and half a turn of the dial is the matrix's own parameter.
const FORWARD = t => 2 * t;
const BACKWARD = t => -2 * t;
const XExp = t => {
    const c = Math.cos(τ * t);
    const s = Math.sin(τ * t);
    return new Matrix(2, 2, new Float32Array([c, 0, 0, -s, 0, -s, c, 0]));
};
const YExp = t => {
    const c = Math.cos(τ * t);
    const s = Math.sin(τ * t);
    return new Matrix(2, 2, new Float32Array([c, 0, -s, 0, s, 0, c, 0]));
};
const ZExp = t => {
    const c = Math.cos(τ * t);
    const s = Math.sin(τ * t);
    return new Matrix(2, 2, new Float32Array([c, -s, 0, 0, 0, 0, c, s]));
};

ExponentiatingGates.XForward = new GateBuilder().
    setSerializedId("e^-iXt").
    setSymbol("e^-i𝜏Xt").
    setTitle("X-Exponentiating Gate (forward)").
    setBlurb("Right-hand rotation around the X axis.\nPasses through ±iX instead of X.").
    setTurnsAt(FORWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.X)).
    setEffectFromTurns(turns => XExp(turns / 2)).
    promiseEffectIsUnitary().
    gate;

ExponentiatingGates.XBackward = new GateBuilder().
    setAlternate(ExponentiatingGates.XForward).
    setSerializedId("e^iXt").
    setSymbol("e^i𝜏Xt").
    setTitle("X-Exponentiating Gate (backward)").
    setBlurb("Left-hand rotation around the X axis.\nPasses through ±iX instead of X.").
    setTurnsAt(BACKWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.X)).
    setEffectFromTurns(turns => XExp(turns / 2)).
    promiseEffectIsUnitary().
    gate;

ExponentiatingGates.YForward = new GateBuilder().
    setSerializedId("e^-iYt").
    setSymbol("e^-i𝜏Yt").
    setTitle("Y-Exponentiating Gate (forward)").
    setBlurb("Right-hand rotation around the Y axis.\nPasses through ±iY instead of Y.").
    setTurnsAt(FORWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.Y)).
    setEffectFromTurns(turns => YExp(turns / 2)).
    promiseEffectIsUnitary().
    gate;

ExponentiatingGates.YBackward = new GateBuilder().
    setAlternate(ExponentiatingGates.YForward).
    setSerializedId("e^iYt").
    setSymbol("e^i𝜏Yt").
    setTitle("Y-Exponentiating Gate (backward)").
    setBlurb("Left-hand rotation around the Y axis.\nPasses through ±iY instead of Y.").
    setTurnsAt(BACKWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.Y)).
    setEffectFromTurns(turns => YExp(turns / 2)).
    promiseEffectIsUnitary().
    gate;

ExponentiatingGates.ZForward = new GateBuilder().
    setSerializedId("e^-iZt").
    setSymbol("e^-i𝜏Zt").
    setTitle("Z-Exponentiating Gate (forward)").
    setBlurb("Right-hand rotation around the Z axis.\nPasses through ±iZ instead of Z.").
    setTurnsAt(FORWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.Z)).
    setEffectFromTurns(turns => ZExp(turns / 2)).
    promiseEffectOnlyPhases().
    gate;

ExponentiatingGates.ZBackward = new GateBuilder().
    setAlternate(ExponentiatingGates.ZForward).
    setSerializedId("e^iZt").
    setSymbol("e^i𝜏Zt").
    setTitle("Z-Exponentiating Gate (backward)").
    setBlurb("Left-hand rotation around the Z axis.\nPasses through ±iZ instead of Z.").
    setTurnsAt(BACKWARD).
    setRenderer(makeCycleRenderer(DIAL_AXIS.Z)).
    setEffectFromTurns(turns => ZExp(turns / 2)).
    promiseEffectOnlyPhases().
    gate;

ExponentiatingGates.all = [
    ExponentiatingGates.XBackward,
    ExponentiatingGates.YBackward,
    ExponentiatingGates.ZBackward,
    ExponentiatingGates.XForward,
    ExponentiatingGates.YForward,
    ExponentiatingGates.ZForward
];

export {ExponentiatingGates, XExp, YExp, ZExp}
