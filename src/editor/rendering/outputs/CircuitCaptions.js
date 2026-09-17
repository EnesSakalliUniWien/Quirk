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

import { fitText, fitParagraph } from "../../../draw/text/TextLayout.js";
import { drawsAsPixels, paintPhaseKey } from "../../../draw/displays/complex/MatrixView.js";
import { CanvasTheme } from "../../../config/CanvasTheme.js";
import { Typography } from "../../../config/Typography.js";
import { Point } from "../../../geometry/Point.js";
import { Rect } from "../../../geometry/Rect.js";
import {
  SUPERPOSITION_GRID_LABEL_SPAN,
  DISPLAY_CAPTION_WIDTH,
  DISPLAY_CAPTION_GAP,
} from "../../geometry/CircuitLayoutConstants.js";

/** The phase key's widest extent under a wide grid. */
const PHASE_KEY_MAX_WIDTH = 220;

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
    "Local wire states\n(Chance/Bloch)",
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
  const pixels = drawsAsPixels(1 << Math.floor(numWire / 2), 1 << Math.ceil(numWire / 2), gridRect);
  const x = gridRect.x;
  const width = Math.max(gridRect.w, DISPLAY_CAPTION_WIDTH);
  let y = gridRect.bottom() + SUPERPOSITION_GRID_LABEL_SPAN + DISPLAY_CAPTION_GAP;

  fitText(painter, "State-vector grid", {
    x,
    y,
    align: "left",
    baseline: "top",
    fill: CanvasTheme.text.muted,
    font: { fontSize: 12, fontFamily: Typography.DEFAULT_FONT_FAMILY },
    width,
    height: 16,
  });
  y += 16;

  // Says what each cell's marks encode, which is otherwise only discoverable by hovering.
  fitParagraph(
    painter,
    pixels
      ? "colour = phase · opacity = magnitude vs largest"
      : "area = chance · ring = log chance · line = phase",
    new Rect(x, y, width, 24),
    {
      alignment: new Point(0, 0),
      fill: CanvasTheme.text.muted,
      maxFontSize: 10,
    },
  );
  y += 24;
  if (pixels) {
    paintPhaseKey(painter, new Rect(x, y, Math.min(width, PHASE_KEY_MAX_WIDTH), 10));
    y += 12;
  }

  // Deferred measurement warning.
  if (context.definition.colIsMeasuredMask(Infinity) !== 0) {
    fitParagraph(
      painter,
      "(assuming measurement deferred)",
      new Rect(x, y, width, 14),
      {
        alignment: new Point(0, 0),
        fill: CanvasTheme.error.text,
      },
    );
  }

  // Discard rate warning.
  const survivalRate = stats.survivalRate(Infinity);
  if (Math.abs(survivalRate - 1) > 0.01) {
    let desc;
    if (survivalRate < 1) {
      const rate = Math.round(survivalRate * 100);
      const rateDesc = survivalRate === 0 ? "0" : rate > 0 ? rate : "<1";
      desc = `kept: ${rateDesc}%`;
    } else {
      const factor = Math.round(survivalRate * 100);
      desc = `over-unity: ${factor}%`;
    }
    fitText(painter, desc, {
      x: context.geometry.rectForSuperpositionDisplay().x - 5,
      y: gridRect.bottom() + SUPERPOSITION_GRID_LABEL_SPAN + 20,
      align: "right",
      baseline: "bottom",
      fill: CanvasTheme.error.text,
      font: { fontSize: 14, fontFamily: Typography.DEFAULT_FONT_FAMILY },
      width: 800,
      height: 50,
    });
  }
}

export { drawLocalStateCaption, drawHintLabels };
