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
 * The model for a state: one column, rows are basis states written as kets.
 *
 * @param {!Matrix} vector A column vector, as src/engine/simulation/stepAlgebra.js's paddedState returns.
 * @returns {!MatrixModel}
 */
function stateModel(vector) {
  const rows = vector.height();
  const bits = Math.round(Math.log2(Math.max(rows, 1)));
  const entries = vector.getColumn(0);
  return {
    rows,
    cols: 1,
    at: (row) => entries[row],
    rowLabel: (i) => `|${Util.bin(i, bits)}⟩`,
    colLabel: () => "",
  };
}

export { operatorModel, stateModel };
