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

import {Rendering} from "../../../config/Rendering.js";
import { extend } from "@pixi/react";
import { Color, Graphics, GraphicsPath } from "pixi.js";
import { CanvasTheme } from "../../../config/CanvasTheme.js";
import { Typography } from "../../../config/Typography.js";
import { PathGeometry } from "../../shapes/PathGeometry.js";
import { fitText } from "../../text/TextLayout.js";
import {rasterMatrix} from '../../renderers/rasters.js';
import {
  traceAmplitudeProbabilitySquare,
  traceProbabilitySquare,
  traceAmplitudeProbabilityCircle,
  traceAmplitudeLogarithmCircle,
  traceAmplitudePhaseDirection,
  PHASE_HAND_WIDTH,
  LOG_RING_WIDTH,
} from "./ComplexCellGeometry.js";

/** React owns this Graphics and its context. Compare values because Matrix buffers are mutable. */
class MatrixGraphics extends Graphics {
  constructor() {
    super();
  }
  set picture(picture) {
    const { values, buf, colors } = picture;
    const same = (a, b) =>
      a && a.length === b.length && b.every((v, i) => Object.is(v, a[i]));
    if (
      same(this.previous?.values, values) &&
      same(this.previous?.buf, buf) &&
      same(this.previous?.colors, colors)
    )
      return;
    this.previous = { values, buf: buf.slice(), colors };
    this.clear();
    const [
      x,
      y,
      diam,
      numCols,
      numRows,
      hasNaN,
      amplitudeCircleFillColor,
      amplitudeCircleStrokeColor,
      amplitudeProbabilityFillColor,
      backColor,
      logCircleStrokeColor,
      showLogCircles,
      density,
      detailed,
    ] = values;
    this.rect(x, y, diam * numCols, diam * numRows).fill(backColor);
    if (!hasNaN && !detailed && diam < 10) {
      const width = Math.max(1, Math.min(numCols, Math.ceil(diam * numCols)));
      const height = Math.max(1, Math.min(numRows, Math.ceil(diam * numRows)));
      const pixels = rasterMatrix({width: () => numCols, height: () => numRows, rawBuffer: () => buf}, width, height);
      const phaseVisible = colors.some(color => color !== undefined);
      const neutral = new Color(amplitudeCircleFillColor ?? CanvasTheme.text.primary).toNumber();
      const w = diam * numCols / width, h = diam * numRows / height;
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const k = (row * width + col) * 4;
          if (pixels[k + 3]) this.rect(x + col*w, y + row*h, w, h).fill({
            color: phaseVisible ? (pixels[k] << 16) | (pixels[k+1] << 8) | pixels[k+2] : neutral, alpha: pixels[k+3]/255});
        }
      }
      return;
    }
    const path = (trace, styles) => {
      const geometry = new GraphicsPath();
      trace(geometry);
      for (const { fill, stroke } of styles) {
        if (fill !== undefined) this.path(geometry).fill(fill);
        if (stroke !== undefined) this.path(geometry).stroke(stroke);
      }
    };
    const cells = (trace) => (geometry) => {
      for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
          const k = (row * numCols + col) * 2;
          trace(
            geometry,
            buf[k],
            buf[k + 1],
            x + diam * col,
            y + diam * row,
            diam,
          );
        }
      }
    };
    if (!hasNaN) {
      if (amplitudeProbabilityFillColor !== undefined) {
        path(cells((geometry, real, imag, cx, cy, d) => {
          if (!density) traceAmplitudeProbabilitySquare(geometry, real, imag, cx, cy, d);
          else if (Math.abs((cx-x)-(cy-y)) < d/2) traceProbabilitySquare(geometry, real, imag, cx, cy, d);
        }), [
          { fill: amplitudeProbabilityFillColor },
          { stroke: { color: CanvasTheme.stroke.grid, width: 0.5 } },
        ]);
      }
      if (amplitudeCircleFillColor !== undefined) {
        path(cells(traceAmplitudeProbabilityCircle), [
          { fill: amplitudeCircleFillColor },
          { stroke: { color: amplitudeCircleStrokeColor, width: 0.5 } },
        ]);
        if (showLogCircles && diam >= 24) {
          path(cells(traceAmplitudeLogarithmCircle), [
            { stroke: { color: logCircleStrokeColor, width: LOG_RING_WIDTH } },
          ]);
        }
      }
    }
    path(
      (trace) =>
        PathGeometry.grid(
          trace,
          x,
          y,
          diam * numCols,
          diam * numRows,
          numCols,
          numRows,
        ),
      [
        { stroke: { color: CanvasTheme.amplitude.phaseHalo, width: 3 } },
        { stroke: { color: CanvasTheme.stroke.grid, width: 1 } },
      ],
    );
    const cellsByColor = new Map();
    colors.forEach((color, index) => {
      if (color === undefined) return;
      if (!cellsByColor.has(color)) cellsByColor.set(color, []);
      cellsByColor.get(color).push(index);
    });
    for (const [color, indices] of cellsByColor) {
      path(
        (trace) => {
          for (const index of indices) {
            traceAmplitudePhaseDirection(
              trace,
              buf[2 * index],
              buf[2 * index + 1],
              x + diam * (index % numCols),
              y + diam * Math.floor(index / numCols),
              diam,
            );
          }
        },
        [
          { stroke: { color: CanvasTheme.amplitude.phaseHalo, width: 3 } },
          { stroke: { color, width: PHASE_HAND_WIDTH } },
        ],
      );
    }
  }
}
extend({ MatrixGraphics });

/** Complex magnitudes, logarithmic rings and phase hands have independent display options. */
export function paintMatrix(
  painter,
  matrix,
  drawArea,
  {
    amplitudeCircleFillColor,
    amplitudeCircleStrokeColor,
    amplitudeProbabilityFillColor,
    backColor = CanvasTheme.probability.background,
    phaseColorForDegrees = () => amplitudeCircleStrokeColor,
    logCircleStrokeColor = CanvasTheme.stroke.faint,
    showPhase = true,
    showLogCircles = true,
    density = false,
    wireCount,
  } = {},
) {
  const numCols = matrix.width(),
    numRows = matrix.height();
  const buf = matrix.rawBuffer();
  const hasNaN = matrix.hasNaN();
  const diam = Math.min(drawArea.w / numCols, drawArea.h / numRows);
  const colors = [];
  if (!hasNaN && showPhase) {
    for (let k = 0; k < buf.length; k += 2) {
      colors.push(
        buf[k] === 0 && buf[k + 1] === 0
          ? undefined
          : phaseColorForDegrees(
              (Math.atan2(buf[k + 1], buf[k]) * 180) / Math.PI,
            ),
      );
    }
  }
  painter.add("pixiMatrixGraphics", {
    picture: {
      values: [
        drawArea.x,
        drawArea.y,
        diam,
        numCols,
        numRows,
        hasNaN,
        amplitudeCircleFillColor,
        amplitudeCircleStrokeColor,
        amplitudeProbabilityFillColor,
        backColor,
        logCircleStrokeColor,
        showLogCircles,
        density,
        (wireCount ?? Math.log2(Math.max(numRows, numCols))) <= Rendering.MATRIX_DETAIL_MAX_QUBITS,
      ],
      buf,
      colors,
    },
  });
  if (hasNaN) {
    fitText(painter, "NaN", {
      x: drawArea.x + (diam * numCols) / 2,
      y: drawArea.y + (diam * numRows) / 2,
      align: "center",
      baseline: "middle",
      fill: CanvasTheme.error.text,
      font: { fontSize: 16, fontFamily: Typography.DEFAULT_FONT_FAMILY },
      width: diam * numCols,
      height: diam * numRows,
    });
  }
}
