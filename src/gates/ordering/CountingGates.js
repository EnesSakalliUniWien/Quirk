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

import { polygon, strokePath, rectangle } from "../../draw/shapes/ShapeView.js";

import { CanvasTheme } from "../../config/CanvasTheme.js";
import { Gate, GateBuilder } from "../../circuit/model/Gate.js";
import { MAKE_HIGHLIGHTED_RENDERER } from "../../draw/gate/GateRenderers.js";
import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { Point } from "../../geometry/Point.js";
import { ketArgs } from "../../engine/simulation/gpu/KetShaderUtil.js";
import { WglArg } from "../../engine/webgl/shader/WglArg.js";

import { offsetShader } from "../arithmetic/IncrementGates.js";
import { makeCycleBitsPermutation, cycleBitsShader } from "./CycleBitsGates.js";
import { QubitMatrix } from "../../engine/math/matrix/QubitMatrix.js";

const CountingGates = {};

// One turnsAt per gate, set on the gate itself and read by its effect and its staircase alike: how
// far round its cycle the gate has come at a time, in turns. A quarter-phased gate is the same cycle
// started three quarters of the way along, and that offset is stated here and nowhere else.
const FORWARD = (t) => t;
const QUARTER_PHASE = (t) => t + 0.75;

const staircaseCurve = (steps) => {
  steps = Math.min(128, steps);
  const curve = [];
  for (let i = 0; i < steps; i++) {
    const x = i / steps;
    const y = i / (steps - 1);
    if (steps < 128) {
      curve.push(new Point(x, y));
    }
    curve.push(new Point(x + 1 / steps, y));
  }
  return curve;
};

/**
 * The square wave beside a counting gate, drawn from the gate's own turnsAt - the very number its
 * effect is built from, so the wave cannot show one thing while the simulation does another.
 */
const STAIRCASE_RENDERER =
  (steps, flip = false) =>
  (args) => {
    MAKE_HIGHLIGHTED_RENDERER(CanvasTheme.gate.time)(args);

    const t = args.gate.turnsAt(args.stats.time) % 1;
    let yOn = args.rect.y + 3;
    let yNeutral = args.rect.bottom();
    let yOff = args.rect.bottom() - 3;
    if (!flip) {
      [yOn, yOff] = [yOff, yOn];
      yNeutral = args.rect.y;
    }
    const xi = args.rect.x;
    const xf = args.rect.right();

    const xt = (p) => Math.min(Math.max(xi + (xf - xi) * p, xi), xf);
    const yt = (p) => yOff + (yOn - yOff) * p;
    const curve = [];
    curve.push(new Point(xi, yNeutral));
    curve.push(
      ...staircaseCurve(steps).map((p) => new Point(xt(p.x - t), yt(p.y))),
    );
    curve.push(
      ...staircaseCurve(steps).map((p) => new Point(xt(p.x + 1 - t), yt(p.y))),
    );
    curve.push(new Point(xf, yNeutral));

    args.painter.group("counting-curve-" + args.painter.order, (painter) => {
      painter.alpha *= 0.3;
      polygon(painter, curve, {
        fill: CanvasTheme.operation.fill,
      });
      for (let i = 1; i < curve.length - 2; i++) {
        strokePath(
          painter,
          [curve[i], curve[i + 1]],
          CanvasTheme.text.primary,
          1,
        );
      }
      if (steps === 2 && t < 0.5) {
        rectangle(painter, args.rect, {
          fill: CanvasTheme.surface.gate,
        });
        rectangle(painter, args.rect, {
          fill: CanvasTheme.surface.gate,
        });
        rectangle(painter, args.rect, {
          fill: CanvasTheme.surface.gate,
        });
      }
    });
  };

/**
 * @param {!number} time
 * @param {!int} factor
 * @param {!int} span
 * @param {!int} state
 * @returns {!int}
 */
function offsetPermutation(time, factor, span, state) {
  const offset = Math.floor(time * (1 << span)) * factor;
  return (state + offset) & ((1 << span) - 1);
}

/**
 * @param {!number} time
 * @param {!int} factor
 * @param {!int} span
 * @param {!int} state
 * @returns {!int}
 */
function bitOffsetPermutation(time, factor, span, state) {
  const offset = Math.floor(time * span) * factor;
  return makeCycleBitsPermutation(offset, span)(state);
}

CountingGates.ClockPulseGate = new GateBuilder()
  .setSerializedIdAndSymbol("X^⌈t⌉")
  .setTitle("Clock Pulse Gate")
  .setBlurb("Xors a square wave into the target wire.")
  .setTurnsAt(FORWARD)
  .setRenderer(STAIRCASE_RENDERER(2))
  .setEffectFromTurns((turns) =>
    turns % 1 < 0.5 ? Matrix.identity(2) : QubitMatrix.PAULI_X,
  )
  .promiseEffectOnlyPermutesAndPhases().gate;

CountingGates.QuarterPhaseClockPulseGate = new GateBuilder()
  .setSerializedId("X^⌈t-¼⌉")
  .setSymbol("X^⌈t-½⌉")
  .setTitle("Clock Pulse Gate (Quarter Phase)")
  .setBlurb("Xors a quarter-phased square wave into the target wire.")
  .setTurnsAt(QUARTER_PHASE)
  .setRenderer(STAIRCASE_RENDERER(2))
  .setEffectFromTurns((turns) =>
    turns % 1 < 0.5 ? Matrix.identity(2) : QubitMatrix.PAULI_X,
  )
  .promiseEffectOnlyPermutesAndPhases().gate;

CountingGates.CountingFamily = Gate.buildFamily(1, 16, (span, builder) =>
  builder
    .setSerializedId("Counting" + span)
    .setSymbol("+⌈t'⌉")
    .setTitle("Counting Gate")
    .setBlurb("Adds an increasing little-endian count into a block of qubits.")
    .setTurnsAt(FORWARD)
    .setRenderer(STAIRCASE_RENDERER(1 << span))
    .setActualEffectToShaderProvider((ctx) =>
      offsetShader.withArgs(
        ...ketArgs(ctx, span),
        WglArg.float("amount", Math.floor(FORWARD(ctx.time) * (1 << span))),
      ),
    )
    .setKnownEffectToTimeVaryingPermutation((t, i) =>
      offsetPermutation(FORWARD(t), +1, span, i),
    ),
);

CountingGates.UncountingFamily = Gate.buildFamily(1, 16, (span, builder) =>
  builder
    .setAlternateFromFamily(CountingGates.CountingFamily)
    .setSerializedId("Uncounting" + span)
    .setSymbol("-⌈t'⌉")
    .setTitle("Down Counting Gate")
    .setBlurb(
      "Subtracts an increasing little-endian count from a block of qubits.",
    )
    .setTurnsAt(FORWARD)
    .setRenderer(STAIRCASE_RENDERER(1 << span, true))
    .setActualEffectToShaderProvider((ctx) =>
      offsetShader.withArgs(
        ...ketArgs(ctx, span),
        WglArg.float("amount", -Math.floor(FORWARD(ctx.time) * (1 << span))),
      ),
    )
    .setKnownEffectToTimeVaryingPermutation((t, i) =>
      offsetPermutation(FORWARD(t), -1, span, i),
    ),
);

CountingGates.RightShiftRotatingFamily = Gate.buildFamily(
  2,
  16,
  (span, builder) =>
    builder
      .setSerializedId(">>t" + span)
      .setSymbol("↟⌈t'⌉")
      .setTitle("Right-Shift Cycling Gate")
      .setBlurb("Right-rotates a block of bits by more and more.")
      .setTurnsAt(FORWARD)
      .setRenderer(STAIRCASE_RENDERER(span, true))
      .setActualEffectToShaderProvider((ctx) =>
        cycleBitsShader(ctx, span, -Math.floor(FORWARD(ctx.time) * span)),
      )
      .setKnownEffectToTimeVaryingPermutation((t, i) =>
        bitOffsetPermutation(FORWARD(t), -1, span, i),
      ),
);

CountingGates.LeftShiftRotatingFamily = Gate.buildFamily(
  2,
  16,
  (span, builder) =>
    builder
      .setSerializedId("<<t" + span)
      .setSymbol("↡⌈t'⌉")
      .setTitle("Left-Shift Cycling Gate")
      .setBlurb("Left-rotates a block of bits by more and more.")
      .setTurnsAt(FORWARD)
      .setRenderer(STAIRCASE_RENDERER(span))
      .setActualEffectToShaderProvider((ctx) =>
        cycleBitsShader(ctx, span, Math.floor(FORWARD(ctx.time) * span)),
      )
      .setKnownEffectToTimeVaryingPermutation((t, i) =>
        bitOffsetPermutation(FORWARD(t), +1, span, i),
      ),
);

CountingGates.all = [
  CountingGates.ClockPulseGate,
  CountingGates.QuarterPhaseClockPulseGate,
  ...CountingGates.CountingFamily.all,
  ...CountingGates.UncountingFamily.all,
  ...CountingGates.RightShiftRotatingFamily.all,
  ...CountingGates.LeftShiftRotatingFamily.all,
];

export { CountingGates };
