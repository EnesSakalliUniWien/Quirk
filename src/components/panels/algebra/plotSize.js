

/** The longest side of a drawn matrix or state in a step card, in pixels. */
const PLOT_SIZE = 180;

/**
 * The CSS size a drawn matrix takes when its longest side is PLOT_SIZE, keeping cells square.
 *
 * @param {!Matrix} matrix
 * @returns {!{width: !number, height: !number}}
 */
function plotSize(matrix) {
  const cell = PLOT_SIZE / Math.max(matrix.width(), matrix.height());
  return { width: matrix.width() * cell, height: matrix.height() * cell };
}

export { plotSize, PLOT_SIZE };
