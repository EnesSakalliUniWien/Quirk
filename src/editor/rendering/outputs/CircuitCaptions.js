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
import { CanvasTheme } from "../../../config/CanvasTheme.js";
import { Typography } from "../../../config/Typography.js";
import { Point } from "../../../geometry/Point.js";
import { Rect } from "../../../geometry/Rect.js";
import {
  SUPERPOSITION_GRID_LABEL_SPAN,
  DISPLAY_CAPTION_WIDTH,
  DISPLAY_CAPTION_GAP,
  DISPLAY_WARNING_STRIP_HEIGHT,
} from "../../geometry/CircuitLayoutConstants.js";

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
 * Renders the state-vector caption and measurement/survival warnings.
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!CircuitStats} stats
 */
function drawHintLabels(context, painter, stats) {
  const gridRect = context.geometry.rectForSuperpositionDisplay();

  // Amplitude hint.
  fitText(painter, "State-vector grid", {
    x: gridRect.right() + DISPLAY_CAPTION_GAP,
    y: gridRect.bottom() + 3,
    align: "left",
    baseline: "top",
    fill: CanvasTheme.text.muted,
    font: { fontSize: 12, fontFamily: Typography.DEFAULT_FONT_FAMILY },
    width: DISPLAY_CAPTION_WIDTH,
    height: 20,
  });

  // Says what each cell's glyphs encode, which is otherwise only discoverable by hovering.
  fitParagraph(
    painter,
    "area = chance\nline = phase",
    new Rect(
      gridRect.right() + DISPLAY_CAPTION_GAP,
      gridRect.bottom() + 18,
      DISPLAY_CAPTION_WIDTH,
      26,
    ),
    {
      alignment: new Point(0, 0),
      fill: CanvasTheme.text.muted,
      maxFontSize: 10,
    },
  );

  // Deferred measurement warning.
  if (context.definition.colIsMeasuredMask(Infinity) !== 0) {
    fitParagraph(
      painter,
      "(assuming measurement deferred)",
      new Rect(
        gridRect.right() + DISPLAY_CAPTION_GAP,
        gridRect.bottom() + 48,
        DISPLAY_CAPTION_WIDTH,
        DISPLAY_WARNING_STRIP_HEIGHT,
      ),
      {
        alignment: new Point(0.5, 0),
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
