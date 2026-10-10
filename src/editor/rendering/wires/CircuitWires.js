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

import { PathGeometry } from "../../../draw/shapes/PathGeometry.js";
import {
  drawPath,
  lineWidth,
  strokePath,
} from "../../../draw/shapes/ShapeView.js";
import { fitText } from "../../../draw/text/TextLayout.js";
import { Layout } from "../../../config/Layout.js";
import { CanvasTheme } from "../../../config/CanvasTheme.js";
import { Simulation } from "../../../config/Simulation.js";
import { Typography } from "../../../config/Typography.js";
import { Point } from "../../../geometry/Point.js";
import { drawWireLabels } from "./CircuitGutter.js";

/** The wire's width: a line rather than a hairline, so it reads at any zoom. */
const WIRE_WIDTH = 1.5;
/** A measured wire is a classical pair of lines this far apart, as its vertical links are. */
const CLASSICAL_WIRE_GAP = 3;
/** The tick across the wire where it turns classical, just past the gate that measured it. */
const CLASSICAL_TICK_HEIGHT = 12;

/**
 * Where a wire is quantum and where it is classical, along its length. Each run lasts as long as the
 * wire keeps its state, so a wire a hundred columns long is a line or two. That also spares the
 * geometry: it is asked where the wire changes state, not where every column is, and each such
 * question costs a scan of the whole circuit (CircuitGeometry.opRect). The wire turns classical in
 * the column after the gate that measured it.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!int} row
 * @param {!number} startX Where the wire begins.
 * @param {!boolean} showLabels Whether the output displays are drawn, which the wire stops before;
 *     otherwise it ends at the centre of the circuit's last column.
 * @returns {!Array.<!{from: !number, to: !number, measured: !boolean}>} The runs, left to right.
 */
function wireRuns(context, row, startX, showLabels) {
  const { definition, geometry } = context;
  // Wires terminate before the superposition display's row labels instead of running to the
  // canvas's right edge.
  const wireEndX = showLabels ? geometry.outputWireEndX() : Infinity;
  const centreOf = (col) => Math.min(geometry.opRect(col).center().x, wireEndX);
  const runs = [];
  let from = startX;
  let measured = false;
  // The state in the column past the last is the one the wire keeps from there on.
  for (let col = 0; col <= definition.columns.length; col++) {
    const measuredHere = definition.locIsMeasured(new Point(col, row));
    if (measuredHere === measured) {
      continue;
    }
    // The state changes between the previous column's centre and this one's.
    const to = col === 0 ? startX : centreOf(col - 1);
    if (to > from) {
      runs.push({ from, to, measured });
      from = to;
    }
    measured = measuredHere;
  }
  runs.push({
    from,
    to: showLabels ? wireEndX : centreOf(definition.columns.length),
    measured,
  });
  return runs;
}

/**
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!boolean} showLabels
 * @param {!PointerInteractionState} hand
 */
function drawWires(context, painter, showLabels, hand) {
  const drawnWireCount = Math.min(
    context.definition.numWires,
    (context.geometry.extraWireStartIndex || Infinity) + 1,
  );

  if (showLabels) {
    drawWireLabels(context, painter, hand, drawnWireCount);
  }

  // Wires: a muted line, heavier and in the classical colour once measured, with a tick where the
  // wire turns classical.
  for (let row = 0; row < drawnWireCount; row++) {
    painter.group(`wire-${row}`, (painter) => {
      painter.alpha = row >= context.geometry.extraWireStartIndex ? 0.5 : 1;
      const segments = [[], []];
      const ticks = [];
      const wireRect = context.geometry.wireRect(row);
      const y = Math.round(wireRect.center().y - 0.5) + 0.5;
      const startX = showLabels
        ? context.geometry.wireInitialStateRect(row).right()
        : 5;
      for (const { from, to, measured } of wireRuns(
        context,
        row,
        startX,
        showLabels,
      )) {
        segments[measured ? 1 : 0].push([from, y, to, y]);
        // The run starts under the gate that measured; the tick sits just past it.
        if (measured) ticks.push(from + Layout.GATE_RADIUS + 3);
      }
      const quantum = {
        color: CanvasTheme.stroke.wire,
        width: lineWidth(painter, WIRE_WIDTH),
      };
      const classical = {
        color: CanvasTheme.iqp.classicalWire,
        width: lineWidth(painter, 1),
      };
      drawPath(
        painter,
        (trace) =>
          segments[0].forEach((segment) =>
            PathGeometry.line(trace, ...segment),
          ),
        [{ stroke: quantum }],
      );
      // A measured wire is a pair of lines either side of where the quantum one ran.
      const half = CLASSICAL_WIRE_GAP / 2;
      drawPath(
        painter,
        (trace) =>
          segments[1].forEach(([x1, , x2]) => {
            PathGeometry.line(trace, x1, y - half, x2, y - half);
            PathGeometry.line(trace, x1, y + half, x2, y + half);
          }),
        [{ stroke: classical }],
      );
      drawPath(
        painter,
        (trace) =>
          ticks.forEach((x) =>
            PathGeometry.line(
              trace,
              x,
              y - CLASSICAL_TICK_HEIGHT / 2,
              x,
              y + CLASSICAL_TICK_HEIGHT / 2,
            ),
          ),
        [{ stroke: { ...classical, width: lineWidth(painter, WIRE_WIDTH) } }],
      );
    });
  }

  // A faint stub under the last wire advertises that dragging a gate below the circuit adds a
  // qubit. While a drag is showing the real preview wire, the hint gets out of the way.
  if (
    showLabels &&
    context.geometry.extraWireStartIndex === undefined &&
    context.definition.numWires < Simulation.MAX_WIRE_COUNT
  ) {
    const hintY =
      Math.round(context.geometry.wireRect(drawnWireCount).center().y - 0.5) +
      0.5;
    const hintRect = context.geometry.wireInitialStateRect(drawnWireCount);
    painter.group(`wire-hint-${painter.order}`, (painter) => {
      strokePath(
        painter,
        [
          new Point(hintRect.right(), hintY),
          new Point(context.geometry.opRect(1).right(), hintY),
        ],
        CanvasTheme.stroke.faint,
        1,
        [4, 4],
      );
    });
    fitText(painter, "+", {
      x: hintRect.center().x,
      y: hintY,
      align: "center",
      baseline: "middle",
      fill: CanvasTheme.stroke.faint,
      font: {
        fontSize: Layout.REGISTER_FONT_SIZE,
        fontFamily: Typography.DEFAULT_FONT_FAMILY,
      },
      width: hintRect.w,
      height: hintRect.h,
    });
  }

  if (
    context.geometry.extraWireStartIndex !== undefined &&
    context.definition.numWires === Simulation.MAX_WIRE_COUNT
  ) {
    fitText(
      painter,
      `(Max wires. Qubit limit is ${Simulation.MAX_WIRE_COUNT}.)`,
      {
        x: 5,
        y: context.geometry.wireRect(Simulation.MAX_WIRE_COUNT).y,
        align: "left",
        baseline: "top",
        fill: CanvasTheme.error.text,
        font: {
          fontSize: 16,
          fontFamily: Typography.MONO_FONT_FAMILY,
          fontWeight: "bold",
        },
        width: 400,
        height: Layout.WIRE_SPACING,
      },
    );
  }
}

/**
 * On an empty circuit, a dashed slot where the first gate goes - the first wire's first column -
 * so the instruction above has a place on the wire to point at.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 */
function drawFirstGateSlot(context, painter) {
  const r = context.geometry.gateRect(0, 0);
  strokePath(
    painter,
    [r.topLeft(), r.topRight(), r.bottomRight(), r.bottomLeft(), r.topLeft()],
    CanvasTheme.text.muted,
    1,
    [3, 3],
  );
  fitText(painter, "drop\na gate", {
    x: r.center().x,
    y: r.center().y,
    align: "center",
    baseline: "middle",
    fill: CanvasTheme.text.muted,
    font: { fontSize: 11, fontFamily: Typography.DEFAULT_FONT_FAMILY },
    width: r.w - 4,
    height: r.h - 4,
  });
}

export { drawWires, drawFirstGateSlot, wireRuns };
