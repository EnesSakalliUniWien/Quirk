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


import { Rendering } from "../../../config/Rendering.js";
import { CanvasTheme, phaseColor } from "../../../config/CanvasTheme.js";
import { Typography } from "../../../config/Typography.js";
import { drawGraphics } from "../../scene/DisplayView.js";
import { drawText, fitText, measureText } from "../../text/TextLayout.js";
import "./MatrixCells.js";

/** Below this many units a side, discs, rings and hands stop reading, so larger registers draw pixels. */
const PIXEL_CELL_SIZE = 16;
/** Below this many units a side, a logarithmic ring has no room to differ from its disc. */
const MIN_LOG_RING_CELL_SIZE = 12;
/** Cells at least this many units a side print their chance in a corner. */
const CHANCE_LABEL_CELL_SIZE = 44;

/**
 * Draws a grid of complex numbers - a state's amplitudes, a density matrix, an operator - one cell
 * per entry: a disc as wide as the entry is large, in its phase's hue; a hand along the exact phase,
 * as long as the amplitude; a logarithmic ring; and, for amplitudes, the chance as a gauge beside
 * the disc. Colour means phase and nothing else. The marks are particles of one Pixi container
 * (MatrixCells.js), which moves them as the numbers change rather than redrawing them.
 *
 * @param {!DisplayView} painter
 * @param {!Matrix} matrix
 * @param {!Rect} drawArea
 * @param {!{backColor: (undefined|!string), showLogCircles: (undefined|!boolean),
 *     showChance: (undefined|!boolean), density: (undefined|!boolean), chanceLabels: (undefined|!boolean),
 *     phaseAlpha: (undefined|!number), showPhase: (undefined|!boolean), wireCount: (undefined|!int)}=} options
 *     showChance draws an amplitude's chance gauge; density draws a density matrix's diagonal
 *     chances instead; chanceLabels prints each big cell's chance; phaseAlpha says how sure the
 *     phases are, fading the hands and, at 0, leaving the discs without a hue.
 */
export function paintMatrix(
  painter,
  matrix,
  drawArea,
  {
    backColor = CanvasTheme.amplitude.background,
    showLogCircles = true,
    showChance = false,
    density = false,
    chanceLabels = false,
    phaseAlpha = 1,
    showPhase = true,
    wireCount,
  } = {},
) {
  const numCols = matrix.width(),
    numRows = matrix.height();
  const hasNaN = matrix.hasNaN();
  const diam = Math.min(drawArea.w / numCols, drawArea.h / numRows);
  const asPixels = !hasNaN && drawsAsPixels(numCols, numRows, drawArea, wireCount);
  painter.add("pixiMatrixCells", {
    picture: {
      x: drawArea.x,
      y: drawArea.y,
      diam,
      cols: numCols,
      rows: numRows,
      buf: matrix.rawBuffer(),
      hasNaN,
      asPixels,
      density,
      logRings: showLogCircles && diam >= MIN_LOG_RING_CELL_SIZE,
      gauges: showChance,
      ticks: diam >= MIN_LOG_RING_CELL_SIZE,
      chanceLabels: chanceLabels && !asPixels && diam >= CHANCE_LABEL_CELL_SIZE,
      phaseAlpha: showPhase ? phaseAlpha : 0,
      colours: {
        back: backColor,
        grid: CanvasTheme.stroke.grid,
        ring: CanvasTheme.stroke.logRing,
        tick: CanvasTheme.stroke.guide,
        hand: CanvasTheme.amplitude.hand,
        handOff: CanvasTheme.text.primary,
        chance: CanvasTheme.amplitude.chance,
        track: CanvasTheme.probability.track,
        unknown: CanvasTheme.amplitude.unknown,
        plate: CanvasTheme.surface.readout,
        label: CanvasTheme.text.primary,
      },
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

/**
 * Whether paintMatrix draws a matrix of this shape as pixels - hue for phase, opacity for
 * magnitude - rather than discs, rings and hands. A matrix over at most MATRIX_DETAIL_MAX_QUBITS
 * qubits always keeps its marks.
 */
export function drawsAsPixels(numCols, numRows, drawArea, wireCount = undefined) {
  const diam = Math.min(drawArea.w / numCols, drawArea.h / numRows);
  const detailed = (wireCount ?? Math.log2(Math.max(numRows, numCols))) <= Rendering.MATRIX_DETAIL_MAX_QUBITS;
  return !detailed && diam < PIXEL_CELL_SIZE;
}

/** How finely the phase wheel is cut. */
const PHASE_WHEEL_STEPS = 48;
/** How far the wheel's labels stand off its rim. */
const PHASE_WHEEL_LABEL_GAP = 4;
const PHASE_WHEEL_FONT = { fontSize: 10, fontFamily: Typography.MONO_FONT_FAMILY };

/**
 * The size of the phase wheel's box, labels and all, for a wheel of `radius`.
 * @param {!number} radius
 * @param {!{labels: (undefined|!boolean)}=} options
 * @returns {!{width: !number, height: !number}}
 */
function phaseWheelSize(radius, { labels = true } = {}) {
  if (!labels) return { width: 2 * radius, height: 2 * radius };
  const side = measureText("180°", PHASE_WHEEL_FONT).width + PHASE_WHEEL_LABEL_GAP;
  const line = measureText("0", PHASE_WHEEL_FONT).fontProperties.fontSize + PHASE_WHEEL_LABEL_GAP;
  return { width: 2 * (radius + side), height: 2 * (radius + line) };
}

/**
 * The key to the hue every phase wears: a ring of the wheel, turning counter-clockwise from 0° at
 * the right, as a hand does, so a hand's colour and its angle are read off the same picture. Labels
 * name the four quarter turns.
 *
 * @param {!DisplayView} painter
 * @param {!number} x The left of the wheel's box (see phaseWheelSize).
 * @param {!number} y The top of the wheel's box.
 * @param {!number} radius
 * @param {!{labels: (undefined|!boolean)}=} options
 * @returns {!{width: !number, height: !number}} The box it took.
 */
export function paintPhaseWheel(painter, x, y, radius, { labels = true } = {}) {
  const size = phaseWheelSize(radius, { labels });
  const cx = x + size.width / 2, cy = y + size.height / 2;
  const inner = radius * 0.55;
  const step = (2 * Math.PI) / PHASE_WHEEL_STEPS;
  drawGraphics(painter, (graphics) => {
    for (let i = 0; i < PHASE_WHEEL_STEPS; i++) {
      // A phase φ turns counter-clockwise on screen, where y runs down: its canvas angle is −φ.
      const from = (i - 0.5) * step, to = (i + 0.5) * step;
      graphics
        .moveTo(cx + Math.cos(from) * inner, cy - Math.sin(from) * inner)
        .arc(cx, cy, radius, -from, -to, true)
        .lineTo(cx + Math.cos(to) * inner, cy - Math.sin(to) * inner)
        .arc(cx, cy, inner, -to, -from, false)
        .closePath()
        .fill(phaseColor((i * 360) / PHASE_WHEEL_STEPS));
    }
  });
  if (labels) {
    const at = (text, dx, dy, align, baseline) => drawText(painter, text, {
      x: cx + dx, y: cy + dy, align, baseline, font: PHASE_WHEEL_FONT, fill: CanvasTheme.text.muted,
    });
    const gap = radius + PHASE_WHEEL_LABEL_GAP;
    at("0°", gap, 0, "left", "middle");
    at("90°", 0, -gap, "center", "bottom");
    at("180°", -gap, 0, "right", "middle");
    at("−90°", 0, gap, "center", "top");
  }
  return size;
}
