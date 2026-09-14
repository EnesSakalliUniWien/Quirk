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

import { PathGeometry } from "../shapes/PathGeometry.js";
import { drawPath, frame, highlightRing, lineWidth, rectangle } from "../shapes/ShapeView.js";
import { fitText } from "../text/TextLayout.js";

import { Layout } from "../../config/Layout.js";
import { CanvasTheme, gateStyle } from "../../config/CanvasTheme.js";
import { Typography } from "../../config/Typography.js";
import { gateButtonRect, rectForResizeTab } from "./GateRects.js";

/** @typedef {import('./GateRenderParams.js').GateRenderParams} GateRenderParams */

/**
 * The circuit's white line around a gate, and the highlight ring outside it while it is hovered.
 * @param {!GateRenderParams} args
 */
function paintOutline(args) {
  rectangle(args.painter, args.rect, {
    stroke: { color: CanvasTheme.text.primary, width: lineWidth(args.painter, 1) },
  });
  if (args.isHighlighted) {
    highlightRing(args.painter, args.rect);
  }
}

/**
 * @param {!GateRenderParams} args
 * @param {!string=} fillColor
 */
function paintBackground(args, fillColor = gateStyle(args.gate).fill) {
  rectangle(args.painter, args.rect, { fill: fillColor });
}

/**
 * @param {!GateRenderParams} args
 */
function paintResizeTab(args) {
  if (!args.isResizeShowing || !args.gate.canChangeInSize()) {
    return;
  }

  const d = Layout.GATE_RADIUS;
  const rect = rectForResizeTab(args.rect);
  const trimRect = rect.skipLeft(2).skipRight(2);
  const { x: cx, y: cy } = trimRect.center();
  const backColor = args.isResizeHighlighted
    ? CanvasTheme.gate.hover
    : CanvasTheme.surface.gate;
  const foreColor = args.isResizeHighlighted
    ? CanvasTheme.text.default
    : CanvasTheme.text.muted;
  args.painter.group("resize-tab-" + args.painter.order, (painter) => {
    painter.alpha *= args.isResizeHighlighted ? 1 : 0.7;
    rectangle(painter, trimRect, { fill: backColor });
    frame(painter, trimRect);
  });
  fitText(args.painter, "resize", {
    x: cx,
    y: cy,
    align: "center",
    baseline: "middle",
    fill: foreColor,
    font: { fontSize: 16, fontFamily: Typography.MONO_FONT_FAMILY },
    width: trimRect.w - 4,
    height: trimRect.h - 4,
  });
  drawPath(
    args.painter,
    (tracer) => {
      const arrowDirs = [
        args.gate.canIncreaseInSize() ? +1 : -1,
        args.gate.canDecreaseInSize() ? -1 : +1,
      ];
      const arrowOffsets = [+1, -1];
      for (const sx of [-1, +1]) {
        for (let k = 0; k < 2; k++) {
          const by = cy + (d * arrowOffsets[k] * 5) / 8;
          const y1 = by + (d * arrowDirs[k]) / 8;
          const y2 = by - (d * arrowDirs[k]) / 8;
          PathGeometry.line(tracer, cx, y1, cx + d * sx * 0.3, y2);
        }
      }
    },
    [{ stroke: { color: foreColor, width: 1 } }],
  );
}

/**
 * @param {!GateRenderParams} args
 * @param {!GraphicsPath} tracer
 */
function traceLocationIndependentOutline(args, tracer) {
  const [x1, x2, y1, y2] = [
    args.rect.x,
    args.rect.right(),
    args.rect.y,
    args.rect.bottom(),
  ];
  const diameter = Math.min(args.rect.h, args.rect.w, Layout.GATE_RADIUS * 2);
  const clip = diameter / (2 + Math.sqrt(2));
  tracer.poly([
    x1,
    y1 + clip,
    x1 + clip,
    y1,

    x2 - clip,
    y1,
    x2,
    y1 + clip,

    x2,
    y2 - clip,
    x2 - clip,
    y2,

    x1 + clip,
    y2,
    x1,
    y2 - clip,
  ]);
}

/**
 * @param {!GateRenderParams} args
 * @param {!string=} normalFillColor
 */
function paintLocationIndependentFrame(
  args,
  normalFillColor = CanvasTheme.surface.gate,
) {
  const backColor = args.isHighlighted ? CanvasTheme.gate.hover : normalFillColor;
  drawPath(
    args.painter,
    (tracer) => traceLocationIndependentOutline(args, tracer),
    [
      { fill: backColor },
      { stroke: { color: CanvasTheme.text.primary, width: lineWidth(args.painter, 1) } },
    ],
  );
}

/**
 * @param {!GateRenderParams} args
 */
function paintGateButton(args) {
  if (!args.isHighlighted || args.hand.isHoldingSomething()) {
    return;
  }

  const buttonRect = gateButtonRect(args.rect);
  const buttonFocus = args.focusPoints.some((pt) => buttonRect.containsPoint(pt));
  rectangle(args.painter, buttonRect, {
    fill: buttonFocus
      ? CanvasTheme.interaction.buttonFocus
      : CanvasTheme.interaction.button,
  });
  fitText(args.painter, "change", {
    x: buttonRect.center().x,
    y: buttonRect.center().y,
    align: "center",
    baseline: "middle",
    fill: CanvasTheme.text.onBright,
    font: { fontSize: 12, fontFamily: Typography.DEFAULT_FONT_FAMILY },
    width: buttonRect.w,
    height: buttonRect.h,
  });
  rectangle(args.painter, buttonRect, {
    stroke: { color: CanvasTheme.text.primary, width: lineWidth(args.painter, 1) },
  });
}

export {
  paintOutline,
  paintBackground,
  paintResizeTab,
  paintLocationIndependentFrame,
  paintGateButton,
};
