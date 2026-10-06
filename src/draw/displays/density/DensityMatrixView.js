import {
  drawsAsPixels,
  paintMatrix,
  paintPhaseWheel,
} from "../complex/MatrixView.js";
import { paintMatrixTooltip } from "../../tooltips/MatrixTooltip.js";
import { fitText, drawText, measureText } from "../../text/TextLayout.js";
import { rectangle, strokePath } from "../../shapes/ShapeView.js";
import { CanvasTheme } from "../../../config/CanvasTheme.js";
import { Typography } from "../../../config/Typography.js";
import { Point } from "../../../geometry/Point.js";
import { Rect } from "../../../geometry/Rect.js";
import { bin, Format } from "../../../base/Format.js";

const LABEL_FONT = {
  fontSize: Typography.LABEL_FONT_SIZE,
  fontFamily: Typography.MONO_FONT_FAMILY,
};
/** The key under the grid: words, in the canvas's own face at the label size, a line each. */
const KEY_FONT = {
  fontSize: Typography.LABEL_FONT_SIZE,
  fontFamily: Typography.DEFAULT_FONT_FAMILY,
};
const KEY_LINE_HEIGHT = 13;
const KEY_GAP = 3;

/** One occupied rectangle for values, dividers, basis labels and cell lookup. */
export function densityGridRect(matrix, area) {
  const labelled = Math.min(area.w, area.h) >= 100;
  const bits = Math.round(Math.log2(matrix.height()));
  const inset = labelled
    ? Math.max(
        24,
        Math.ceil(
          measureText(bin(matrix.height() - 1, bits), LABEL_FONT).width,
        ) + 8,
      )
    : 0;
  const footer = labelled ? KEY_GAP + 2 * KEY_LINE_HEIGHT + 2 : 0;
  const side = Math.max(1, Math.min(area.w - inset, area.h - inset - footer));
  return new Rect(area.x + inset, area.y + inset, side, side);
}

export function paintDensityMatrix(
  painter,
  matrix,
  drawArea,
  focusPoints = [],
  backgroundColor = CanvasTheme.amplitude.background,
) {
  const grid = densityGridRect(matrix, drawArea);
  const pixels =
    !matrix.hasNaN() && drawsAsPixels(matrix.width(), matrix.height(), grid);
  rectangle(painter, drawArea, { fill: backgroundColor });
  paintMatrix(painter, matrix, grid, {
    density: true,
    backColor: backgroundColor,
  });
  // Pixels have no diagonal bars, so the diagonal that holds the probabilities is outlined instead.
  if (pixels) paintDiagonalOutline(painter, matrix, grid);
  if (grid.x > drawArea.x) {
    const caption = (text, line) =>
      fitText(painter, text, {
        x: drawArea.center().x,
        y: grid.bottom() + KEY_GAP + line * KEY_LINE_HEIGHT,
        align: "center",
        baseline: "top",
        font: KEY_FONT,
        width: drawArea.w - 4,
        height: KEY_LINE_HEIGHT,
        fill: CanvasTheme.text.muted,
      });
    // The same words the state-vector grid's key uses: a disc is its entry's size and wears its
    // phase's hue, and a chance is a height - here the diagonal's shade.
    if (pixels) {
      paintPhaseWheel(painter, grid.x, grid.bottom() + KEY_GAP + 1, 5, {
        labels: false,
      });
      caption("colour = phase", 0);
      caption("opacity = |ρ| vs largest · diagonal outlined", 1);
    } else {
      caption("disc = |ρ| · colour = phase", 0);
      caption("diagonal shade = probability", 1);
    }
  }
  const n = Math.round(Math.log2(matrix.height()));
  if (grid.x > drawArea.x) paintBasisLabels(painter, matrix, grid, n);
  paintMatrixTooltip(
    painter,
    matrix,
    grid,
    focusPoints,
    (c, r) =>
      c === r
        ? `Probability of |${bin(c, n)}⟩ (decimal ${c})`
        : `Coupling of |${bin(r, n)}⟩ to ⟨${bin(c, n)}| (decimal ${r} to ${c})`,
    (c, r, v) =>
      c === r
        ? (v.real * 100).toFixed(4) + "%"
        : v.toString(new Format(false, 0, 6, ", ")),
    () =>
      pixels
        ? "Opacity is magnitude relative to the largest entry; the outlined diagonal holds probabilities."
        : "Diagonal bars: probability; a disc: the size of its entry; a hand: its phase.",
  );
}

/** Traces the diagonal cells along their edges, so the outline marks them without covering one. */
function paintDiagonalOutline(painter, matrix, grid) {
  const cell = grid.w / matrix.width();
  const at = (column, row) =>
    new Point(grid.x + column * cell, grid.y + row * cell);
  const above = [];
  const below = [];
  for (let i = 0; i < matrix.width(); i++) {
    above.push(at(i, i), at(i + 1, i));
    below.push(at(i, i), at(i, i + 1));
  }
  const end = at(matrix.width(), matrix.width());
  strokePath(painter, [...above, end], CanvasTheme.stroke.guide);
  strokePath(painter, [...below, end], CanvasTheme.stroke.guide);
}

function paintBasisLabels(painter, matrix, grid, bits) {
  const cell = grid.w / matrix.width();
  const font = LABEL_FONT;
  // A column label needs its width but a row label only its height, so rows stay fully labelled
  // longer. Sparse labels keep dense grids legible; the inspector names every selected basis state.
  const columnStride = Math.max(
    1,
    Math.ceil(
      (measureText(bin(matrix.width() - 1, bits), font).width + 4) / cell,
    ),
  );
  const rowStride = Math.max(1, Math.ceil((font.fontSize + 3) / cell));
  for (let i = 0; i < matrix.width(); i += columnStride) {
    drawText(painter, bin(i, bits), {
      x: grid.x + (i + 0.5) * cell,
      y: grid.y - 5,
      align: "center",
      font,
    });
  }
  for (let i = 0; i < matrix.height(); i += rowStride) {
    drawText(painter, bin(i, bits), {
      x: grid.x - 4,
      y: grid.y + (i + 0.5) * cell,
      align: "right",
      baseline: "middle",
      font,
    });
  }
}
