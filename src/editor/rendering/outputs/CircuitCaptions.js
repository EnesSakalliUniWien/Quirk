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

import {
  fitText,
  fitParagraph,
  measureText,
} from "../../../draw/text/TextLayout.js";
import { ketLabel, wireLabel } from "../../../circuit/registerLabels.js";
import { referencedOutputGrid } from "./CircuitAmplitudes.js";
import {
  drawsAsPixels,
  paintPhaseWheel,
} from "../../../draw/displays/complex/MatrixView.js";
import { CanvasTheme } from "../../../config/CanvasTheme.js";
import { Typography } from "../../../config/Typography.js";
import { Point } from "../../../geometry/Point.js";
import { Rect } from "../../../geometry/Rect.js";
import {
  SUPERPOSITION_GRID_LABEL_SPAN,
  DISPLAY_CAPTION_WIDTH,
  DISPLAY_CAPTION_GAP,
} from "../../geometry/CircuitLayoutConstants.js";

/** A key line's height on the canvas, which a 12px line fits. */
const KEY_LINE_HEIGHT = 16;
/** The smallest the key's lines are set; a narrower key shrinks a long line further on its own. */
const KEY_MIN_FONT_SIZE = 10;

/** The phase wheel's radius in the grid's key. */
const PHASE_WHEEL_RADIUS = 14;
/** The most a caveat under the key may take: two lines. */
const CAVEAT_HEIGHT = 30;

/**
 * Where the followed state stands, for the captions: before every operation, or after one.
 * @param {!{operation: !int}} follow
 * @returns {!string}
 */
const followedPoint = (follow) =>
  follow.operation === 0
    ? "at the start"
    : `after operation ${follow.operation}`;

/** Caption below the per-wire probability and Bloch outputs. */
function drawLocalStateCaption(context, painter, numWire, chanceCol) {
  const bottom = context.geometry.wireRect(numWire - 1).bottom();
  const capX = context.geometry.opRect(chanceCol).x - 35;
  // Keep the caption clear of the superposition grid's rotated column labels.
  const capW = Math.min(
    160,
    context.geometry.rectForSuperpositionDisplay().x - capX - 10,
  );
  fitParagraph(
    painter,
    context.follow === undefined
      ? "Local wire states\n(Prob./Bloch)"
      : `Local wire states\n${followedPoint(context.follow)}`,
    new Rect(capX, bottom + 8, capW, 40),
    {
      alignment: new Point(0.5, 0),
      fill: CanvasTheme.text.muted,
    },
  );
}

/**
 * Renders the state-vector grid's key and the measurement/survival warnings. The key starts under
 * the grid's left column labels, so it stays on screen whenever any of the grid does.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!CircuitStats} stats
 */
function drawHintLabels(context, painter, stats) {
  const gridRect = context.geometry.rectForSuperpositionDisplay();
  const numWire = context.geometry.importantWireCount();
  const pixels = drawsAsPixels(
    1 << Math.floor(numWire / 2),
    1 << Math.ceil(numWire / 2),
    gridRect,
    numWire,
  );
  const x = gridRect.x;
  const width = Math.max(gridRect.w, DISPLAY_CAPTION_WIDTH);
  let y =
    gridRect.bottom() + SUPERPOSITION_GRID_LABEL_SPAN + DISPLAY_CAPTION_GAP;
  /** One line of the key: the title at its own size, the rest at the size they share. */
  const line = (
    text,
    {
      fill = CanvasTheme.text.muted,
      fontWeight = "normal",
      fontSize = 12,
    } = {},
  ) => {
    fitText(painter, text, {
      x,
      y,
      align: "left",
      baseline: "top",
      fill,
      font: {
        fontSize,
        fontFamily: Typography.DEFAULT_FONT_FAMILY,
        fontWeight,
      },
      width,
      height: KEY_LINE_HEIGHT,
    });
    y += KEY_LINE_HEIGHT;
  };

  line(
    context.follow === undefined
      ? "State-vector grid"
      : `State-vector grid · ${followedPoint(context.follow)}`,
    { fill: CanvasTheme.text.primary, fontWeight: "600" },
  );

  // What each cell's marks encode, a short line each, so every line fits the key at one size;
  // otherwise only hovering says. Colour means phase and nothing else, so it is named once, beside
  // the wheel below; every other mark is a neutral ink.
  const lines = pixels
    ? ["opacity = magnitude vs largest"]
    : ["disc size = magnitude", "bar = prob. · ring = log prob."];
  // Which amplitude the phases are measured from, since only the phases between them are physical:
  // its phase is the wheel's 0°.
  const { reference } = referencedOutputGrid(context);
  const registers = context.definition.registers.fittingIn(numWire);
  if (reference !== undefined) {
    const from = `|${ketLabel(registers, numWire, reference)}⟩`;
    lines.push(pixels ? `phase 0° at ${from}` : `hand = phase, 0° at ${from}`);
  }
  // How a cell's ket is read off the labels: the row's bits, then the column's, highest wire first.
  const colWires = Math.floor(numWire / 2);
  const wires = (from, to) =>
    Array.from({ length: from - to + 1 }, (_, i) =>
      wireLabel(registers, from - i),
    ).join(" ");
  lines.push(
    colWires === 0
      ? `ket = rows ${wires(numWire - 1, 0)}`
      : `ket = rows ${wires(numWire - 1, colWires)}, then columns ${wires(colWires - 1, 0)}`,
  );
  // One size for all of them - the largest at which the longest fits - so the key reads as one block.
  const keyFont = { fontSize: 12, fontFamily: Typography.DEFAULT_FONT_FAMILY };
  const widest = Math.max(
    ...lines.map((text) => measureText(text, keyFont).width),
  );
  const fontSize = Math.max(
    KEY_MIN_FONT_SIZE,
    Math.min(12, (12 * width) / widest),
  );
  for (const text of lines) line(text, { fontSize });

  // The wheel, and what it keys beside it.
  y += 4;
  const wheel = paintPhaseWheel(painter, x, y, PHASE_WHEEL_RADIUS);
  fitText(painter, "colour = phase", {
    x: x + wheel.width + 8,
    y: y + wheel.height / 2,
    align: "left",
    baseline: "middle",
    fill: CanvasTheme.text.muted,
    font: { fontSize, fontFamily: Typography.DEFAULT_FONT_FAMILY },
    width: width - wheel.width - 8,
    height: KEY_LINE_HEIGHT,
  });
  y += wheel.height + 4;

  // The caveats, together under the key, each a plain sentence. They describe the state shown, so
  // they follow the playhead: before a measurement there is none to defer.
  const caveat = (text, fill = CanvasTheme.text.muted) => {
    const used = fitParagraph(
      painter,
      text,
      new Rect(x, y, width, CAVEAT_HEIGHT),
      {
        alignment: new Point(0, 0),
        fill,
        maxFontSize: 11,
      },
    );
    y += used.h + 3;
  };
  if (stats.circuitDefinition.colIsMeasuredMask(Infinity) !== 0) {
    // A caveat, not an error: magenta is kept for what went wrong.
    caveat(
      "Measurements shown as if made at the end: the coherent state, not one outcome.",
    );
  }
  const survivalRate = stats.survivalRate(Infinity);
  if (Math.abs(survivalRate - 1) > 0.01) {
    if (survivalRate < 1) {
      const rate = Math.round(survivalRate * 100);
      const kept = survivalRate === 0 ? "0" : rate > 0 ? rate : "<1";
      caveat(
        `Post-selection keeps ${kept}% of runs; the probabilities shown are conditional on those runs.`,
      );
    } else {
      // More than every run surviving is not physical: that one is a mistake in the circuit.
      caveat(
        `Over-unity: ${Math.round(survivalRate * 100)}% of runs survive, so an operation is not unitary.`,
        CanvasTheme.error.text,
      );
    }
  }
}

export { drawLocalStateCaption, drawHintLabels };
