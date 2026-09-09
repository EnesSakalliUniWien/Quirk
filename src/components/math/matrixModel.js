import { Util } from "../../base/Util.js";

/**
 * What a matrix view shows, described rather than drawn.
 *
 * This is the seam the matrix displays are built on: a model says how big the matrix is, what is in
 * each cell, and what to call each row and column. A renderer turns that into something on screen -
 * symbols for a small exact matrix, a plot for a large one - and the two never need to know about
 * each other. Adding density matrices, operators or states later means another function that
 * returns one of these, not another view.
 *
 * @typedef {!{
 *     rows: !int,
 *     cols: !int,
 *     at: !function(!int, !int): !Complex,
 *     rowLabel: !function(!int): !string,
 *     colLabel: !function(!int): !string
 * }} MatrixModel
 */

/**
 * The model for an operator: rows and columns are basis states, written as kets.
 *
 * @param {!Matrix} matrix
 * @returns {!MatrixModel}
 */
function operatorModel(matrix) {
  const rows = matrix.height();
  const cols = matrix.width();
  const bits = Math.round(Math.log2(Math.max(rows, cols)));
  const columns = Array.from({ length: cols }, (_, c) => matrix.getColumn(c));
  const ket = (i) => `|${Util.bin(i, bits)}⟩`;
  return {
    rows,
    cols,
    at: (row, col) => columns[col][row],
    rowLabel: ket,
    colLabel: ket,
  };
}

/**
 * @param {!MatrixModel} model
 * @returns {!Array.<!{row: !int, col: !int, value: !Complex}>} Every cell, flat, for renderers that
 *     want data rather than indices.
 */
function modelCells(model) {
  const cells = [];
  for (let row = 0; row < model.rows; row++) {
    for (let col = 0; col < model.cols; col++) {
      cells.push({ row, col, value: model.at(row, col) });
    }
  }
  return cells;
}

export { operatorModel, modelCells };
