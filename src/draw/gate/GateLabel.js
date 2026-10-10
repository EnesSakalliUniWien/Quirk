import { createElement, Fragment } from "react";
import "../text/LabelView.js";
import { measureText, textLayoutVersion } from "../text/TextLayout.js";

/** A row of runs is this many times as tall as its largest font, and rows are this far apart. */
const ROW_HEIGHT = 1.4;
const ROW_GAP = 1;
/**
 * A base beside an exponent has a margin above it, and an exponent one below it, this many times its
 * font size, which lowers the one and raises the other.
 */
const MARGIN = 0.3;

/**
 * The nearest whole number, a half rounding up, as the flexbox engine this layout replaces snapped
 * every box it placed, so that labels stay exactly where they were. A hair over half, because that
 * engine's single-precision arithmetic could leave a half a hair short of it.
 */
const snap = (value) => Math.floor(value + 0.5001);

/** How far a box can scale down to fit `natural`, a size that may be nothing. */
const fits = (box, natural) => (natural > 0 ? box / natural : Infinity);

/**
 * @typedef {object} RunSize
 * @property {number} width The run's text at its natural size, as measureText says.
 * @property {number} height
 * @property {number} fontSize
 * @property {boolean=} exponent Whether the run is an exponent, which sits at its box's top left.
 */

/**
 * Where each run of a gate's label goes. The label is rows stacked as a block in the middle of its
 * box, a gap between them. A row is as tall as its largest font asks, and shrinks in proportion
 * when the rows and gaps overflow the box. The runs of a row sit side by side in the middle of it,
 * each in a box as wide as its text, rounded up, shrinking in proportion when they overflow the
 * row, and as tall as the row, a base lowered and an exponent raised when a row has more than one.
 * A run's text is drawn in its box, scaled down if it does not fit and never up, in the middle of
 * the box, an exponent at its top left.
 *
 * @param {!number} width The box the label is laid out in.
 * @param {!number} height
 * @param {!Array.<!Array.<!RunSize>>} rows
 * @returns {!Array.<!Array.<!{x: !number, y: !number, scale: !number}>>} Each run's text, its top
 *     left corner relative to the box's, and the factor it is drawn at.
 */
export function layoutGateLabel(width, height, rows) {
  const heights = rows.map(
    (runs) => ROW_HEIGHT * Math.max(...runs.map((run) => run.fontSize)),
  );
  const gaps = ROW_GAP * (rows.length - 1);
  const total = heights.reduce((sum, rowHeight) => sum + rowHeight, 0);
  const squeeze =
    total + gaps > height ? Math.max(0, (height - gaps) / total) : 1;
  let rowTop = (height - total * squeeze - gaps) / 2;
  return rows.map((runs, index) => {
    const rowHeight = heights[index] * squeeze;
    const placed = layoutRow(width, rowTop, rowHeight, runs);
    rowTop += rowHeight + ROW_GAP;
    return placed;
  });
}

function layoutRow(width, rowTop, rowHeight, runs) {
  const widths = runs.map((run) => Math.ceil(run.width));
  const total = widths.reduce((sum, boxWidth) => sum + boxWidth, 0);
  const squeeze = total > width ? width / total : 1;
  let left = (width - total * squeeze) / 2;
  return runs.map((run, index) => {
    const boxWidth = widths[index] * squeeze;
    const marginTop =
      runs.length > 1 && !run.exponent ? MARGIN * run.fontSize : 0;
    const marginBottom = run.exponent ? MARGIN * run.fontSize : 0;
    // A box is centred in its row with its margins, so it moves half of the difference between them.
    const offset = (marginTop - marginBottom) / 2;
    const boxLeft = snap(left);
    const boxTop = snap(rowTop) + snap(offset);
    const pixelsWide = snap(left + boxWidth) - boxLeft;
    const pixelsHigh =
      snap(rowTop + offset + rowHeight) - snap(rowTop + offset);
    left += boxWidth;
    const scale = Math.min(
      1,
      fits(pixelsWide, run.width),
      fits(pixelsHigh, run.height),
    );
    return {
      x: boxLeft + (run.exponent ? 0 : (pixelsWide - run.width * scale) / 2),
      y: boxTop + (run.exponent ? 0 : (pixelsHigh - run.height * scale) / 2),
      scale,
    };
  });
}

/** Rows of text runs, arranged within the gate's rect, which circuit geometry owns. */
export function paintGateLabel(painter, rect, rows, fill) {
  const sizes = rows.map((runs) =>
    runs.map(({ text, font, exponent = false }) => {
      const { width, height } = measureText(text, font);
      return { width, height, fontSize: font.fontSize, exponent };
    }),
  );
  const placed = layoutGateLabel(rect.w, rect.h, sizes);
  const runs = rows.flatMap((row, rowIndex) =>
    row.map(({ text, font }, runIndex) => {
      const { x, y, scale } = placed[rowIndex][runIndex];
      return {
        key: `${rowIndex}:${runIndex}`,
        x: rect.x + x,
        y: rect.y + y,
        scale,
        label: [
          text,
          font,
          fill,
          painter.pixelRatio,
          undefined,
          textLayoutVersion,
        ],
      };
    }),
  );
  painter.add(GateLabel, { runs });
}

/** The runs' label views, in no container of their own: they sit in the gate's, in its coordinates. */
function GateLabel({ runs }) {
  return createElement(
    Fragment,
    null,
    runs.map((run) => createElement("pixiLabelView", run)),
  );
}
