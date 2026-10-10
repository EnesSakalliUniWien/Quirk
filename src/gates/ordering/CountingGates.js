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

import { polygon, rectangle, strokePath } from "../../draw/shapes/ShapeView.js";
import { paintGateSymbol } from "../../draw/gate/GateSymbol.js";
import { Rect } from "../../geometry/Rect.js";

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

/** Counting gates and their shared rendering and permutation helpers. */
class CountingGates {
  // One turnsAt per gate, set on the gate itself and read by its effect and its staircase alike: how
  // far round its cycle the gate has come at a time, in turns. A quarter-phased gate is the same cycle
  // started three quarters of the way along, and that offset is stated here and nowhere else.
  static #FORWARD(t) {
    return t;
  }

  static #QUARTER_PHASE(t) {
    return t + 0.75;
  }

  static #staircaseCurve(steps) {
    const stepCount = Math.min(128, steps);
    const curve = [];
    for (let i = 0; i < stepCount; i++) {
      const x = i / stepCount;
      const y = i / (stepCount - 1);
      if (stepCount < 128) {
        curve.push(new Point(x, y));
      }
      curve.push(new Point(x + 1 / stepCount, y));
    }
    return curve;
  }

  /**
   * The square wave beside a counting gate, drawn from the gate's own turnsAt - the very number its
   * effect is built from, so the wave cannot show one thing while the simulation does another.
   */
  static #STAIRCASE_RENDERER(steps, flip = false) {
    return (args) => {
      const { gate, stats, rect } = args;
      const t = gate.turnsAt(stats.time) % 1;
      // A clock pulse does nothing for the first half of its cycle: its tile drops the time colour
      // then, and keeps its label, so the pulse reads as on and off rather than as an empty box.
      const resting = steps === 2 && t < 0.5;
      MAKE_HIGHLIGHTED_RENDERER(resting ? undefined : CanvasTheme.gate.time)(
        args,
      );

      // Counting up climbs and counting down falls, and a pulse is on when it is high: the value is
      // the height. The left edge is now; the steps scroll in from the right as t runs on.
      const yOn = flip ? rect.bottom() - 3 : rect.y + 3;
      const yNeutral = flip ? rect.y : rect.bottom();
      const yOff = flip ? rect.y + 3 : rect.bottom() - 3;
      const xi = rect.x;
      const xf = rect.right();

      const xt = (p) => Math.min(Math.max(xi + (xf - xi) * p, xi), xf);
      const yt = (p) => yOff + (yOn - yOff) * p;
      const staircase = CountingGates.#staircaseCurve(steps);
      const curve = [
        new Point(xi, yNeutral),
        ...staircase.map(({ x, y }) => new Point(xt(x - t), yt(y))),
        ...staircase.map(({ x, y }) => new Point(xt(x + 1 - t), yt(y))),
        new Point(xf, yNeutral),
      ];

      args.painter.group(`counting-curve-${args.painter.order}`, (painter) => {
        painter.alpha *= 0.3;
        polygon(painter, curve, {
          fill: CanvasTheme.operation.fill,
        });
      });
      args.painter.group(`counting-steps-${args.painter.order}`, (painter) => {
        painter.alpha *= 0.65;
        for (let i = 1; i < curve.length - 2; i++) {
          strokePath(
            painter,
            [curve[i], curve[i + 1]],
            CanvasTheme.text.primary,
            1,
          );
        }
      });
      // The value now, as a solid level at the left edge, so a step taken is seen being taken.
      const stepCount = Math.min(128, steps);
      const now = yt(Math.floor(t * stepCount) / (stepCount - 1));
      polygon(
        args.painter,
        [
          new Point(xi, yNeutral),
          new Point(xi, now),
          new Point(xi + 3, now),
          new Point(xi + 3, yNeutral),
        ],
        { fill: CanvasTheme.operation.fill },
      );
      // The name again over the steps, on a plate of the tile's own fill, so no step line runs
      // through it.
      const plate = new Rect(rect.x + 4, rect.center().y - 11, rect.w - 8, 22);
      args.painter.group(`counting-name-${args.painter.order}`, (painter) => {
        painter.alpha *= 0.88;
        rectangle(painter, plate, {
          fill: resting ? CanvasTheme.surface.gate : CanvasTheme.gate.time,
        });
      });
      paintGateSymbol(args);
    };
  }

  /**
   * @param {!number} time
   * @param {!int} factor
   * @param {!int} span
   * @param {!int} state
   * @returns {!int}
   */
  static #offsetPermutation(time, factor, span, state) {
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
  static #bitOffsetPermutation(time, factor, span, state) {
    const offset = Math.floor(time * span) * factor;
    return makeCycleBitsPermutation(offset, span)(state);
  }

  static ClockPulseGate = new GateBuilder()
    .setSerializedIdAndSymbol("X^⌈t⌉")
    .setTitle("Clock Pulse Gate")
    .setBlurb("Xors a square wave into the target wire.")
    .setTurnsAt(CountingGates.#FORWARD)
    .setRenderer(CountingGates.#STAIRCASE_RENDERER(2))
    .setEffectFromTurns((turns) =>
      turns % 1 < 0.5 ? Matrix.identity(2) : QubitMatrix.PAULI_X,
    )
    .promiseEffectOnlyPermutesAndPhases().gate;

  static QuarterPhaseClockPulseGate = new GateBuilder()
    .setSerializedId("X^⌈t-¼⌉")
    .setSymbol("X^⌈t-½⌉")
    .setTitle("Clock Pulse Gate (Quarter Phase)")
    .setBlurb("Xors a quarter-phased square wave into the target wire.")
    .setTurnsAt(CountingGates.#QUARTER_PHASE)
    .setRenderer(CountingGates.#STAIRCASE_RENDERER(2))
    .setEffectFromTurns((turns) =>
      turns % 1 < 0.5 ? Matrix.identity(2) : QubitMatrix.PAULI_X,
    )
    .promiseEffectOnlyPermutesAndPhases().gate;

  static CountingFamily = Gate.buildFamily(1, 16, (span, builder) =>
    builder
      .setSerializedId(`Counting${span}`)
      .setSymbol("+⌈t'⌉")
      .setTitle("Counting Gate")
      .setBlurb(
        "Adds an increasing little-endian count into a block of qubits.",
      )
      .setTurnsAt(CountingGates.#FORWARD)
      .setRenderer(CountingGates.#STAIRCASE_RENDERER(1 << span))
      .setActualEffectToShaderProvider((ctx) =>
        offsetShader.withArgs(
          ...ketArgs(ctx, span),
          WglArg.float(
            "amount",
            Math.floor(CountingGates.#FORWARD(ctx.time) * (1 << span)),
          ),
        ),
      )
      .setKnownEffectToTimeVaryingPermutation((t, i) =>
        CountingGates.#offsetPermutation(
          CountingGates.#FORWARD(t),
          +1,
          span,
          i,
        ),
      ),
  );

  static UncountingFamily = Gate.buildFamily(1, 16, (span, builder) =>
    builder
      .setAlternateFromFamily(CountingGates.CountingFamily)
      .setSerializedId(`Uncounting${span}`)
      .setSymbol("-⌈t'⌉")
      .setTitle("Down Counting Gate")
      .setBlurb(
        "Subtracts an increasing little-endian count from a block of qubits.",
      )
      .setTurnsAt(CountingGates.#FORWARD)
      .setRenderer(CountingGates.#STAIRCASE_RENDERER(1 << span, true))
      .setActualEffectToShaderProvider((ctx) =>
        offsetShader.withArgs(
          ...ketArgs(ctx, span),
          WglArg.float(
            "amount",
            -Math.floor(CountingGates.#FORWARD(ctx.time) * (1 << span)),
          ),
        ),
      )
      .setKnownEffectToTimeVaryingPermutation((t, i) =>
        CountingGates.#offsetPermutation(
          CountingGates.#FORWARD(t),
          -1,
          span,
          i,
        ),
      ),
  );

  static RightShiftRotatingFamily = Gate.buildFamily(2, 16, (span, builder) =>
    builder
      .setSerializedId(`>>t${span}`)
      .setSymbol("↟⌈t'⌉")
      .setTitle("Right-Shift Cycling Gate")
      .setBlurb("Right-rotates a block of bits by more and more.")
      .setTurnsAt(CountingGates.#FORWARD)
      .setRenderer(CountingGates.#STAIRCASE_RENDERER(span, true))
      .setActualEffectToShaderProvider((ctx) =>
        cycleBitsShader(
          ctx,
          span,
          -Math.floor(CountingGates.#FORWARD(ctx.time) * span),
        ),
      )
      .setKnownEffectToTimeVaryingPermutation((t, i) =>
        CountingGates.#bitOffsetPermutation(
          CountingGates.#FORWARD(t),
          -1,
          span,
          i,
        ),
      ),
  );

  static LeftShiftRotatingFamily = Gate.buildFamily(2, 16, (span, builder) =>
    builder
      .setSerializedId(`<<t${span}`)
      .setSymbol("↡⌈t'⌉")
      .setTitle("Left-Shift Cycling Gate")
      .setBlurb("Left-rotates a block of bits by more and more.")
      .setTurnsAt(CountingGates.#FORWARD)
      .setRenderer(CountingGates.#STAIRCASE_RENDERER(span))
      .setActualEffectToShaderProvider((ctx) =>
        cycleBitsShader(
          ctx,
          span,
          Math.floor(CountingGates.#FORWARD(ctx.time) * span),
        ),
      )
      .setKnownEffectToTimeVaryingPermutation((t, i) =>
        CountingGates.#bitOffsetPermutation(
          CountingGates.#FORWARD(t),
          +1,
          span,
          i,
        ),
      ),
  );

  static all = [
    CountingGates.ClockPulseGate,
    CountingGates.QuarterPhaseClockPulseGate,
    ...CountingGates.CountingFamily.all,
    ...CountingGates.UncountingFamily.all,
    ...CountingGates.RightShiftRotatingFamily.all,
    ...CountingGates.LeftShiftRotatingFamily.all,
  ];
}

export { CountingGates };
