import {Layout} from '../../../config/Layout.js';

/**
 * @typedef {{left: !number, right: !number}} CircuitSpan A stretch of the circuit's x axis, in circuit
 *     units.
 */

/**
 * Which columns have anything to draw within a stretch of the circuit, so that a circuit wider than
 * the screen describes only the columns that can show. A column draws within its own cell, a column
 * spacing wide around its centre. A gate spanning several columns draws on through the cells of the
 * columns it covers, and its column is in while any of them touches the stretch.
 *
 * Cells only move right as the index grows, so the ends of the stretch are found by bisecting. That
 * asks the geometry where a handful of columns are rather than where each is, which matters: every
 * such question costs a scan of the whole circuit (CircuitGeometry.opRect).
 *
 * @param {!CircuitDefinition} definition
 * @param {!CircuitGeometry} geometry
 * @param {undefined|!CircuitSpan} range The stretch to draw; undefined for all of the circuit.
 * @returns {!{columns: !Array.<!int>, left: !number, right: !number}} The columns to draw, in order,
 *     and the stretch within which nothing left out can show: a view that stays inside it needs no
 *     column the scene was described without.
 */
function columnsInRange(definition, geometry, range) {
    const count = definition.columns.length;
    if (range === undefined || count === 0) {
        return {columns: definition.columns.map((_, col) => col), left: -Infinity, right: Infinity};
    }
    const half = Layout.COLUMN_SPACING / 2;
    const cellLeft = col => geometry.opRect(col).center().x - half;
    const cellRight = col => geometry.opRect(col).center().x + half;

    // The first column whose cell ends inside the stretch, and the last whose cell starts inside it.
    const first = firstWhere(count, col => cellRight(col) >= range.left);
    const last = firstWhere(count, col => cellLeft(col) > range.right) - 1;

    const columns = [];
    // The farthest column reached by any column left out on the left: the view may scroll left as
    // far as where that column's cell ends before one of them would show.
    let farthestLeftOut = -1;
    for (let col = 0; col <= last; col++) {
        const reaches = col + Math.max(1, definition.columns[col].maximumGateWidth()) - 1;
        if (reaches >= first) {
            columns.push(col);
        } else {
            farthestLeftOut = Math.max(farthestLeftOut, reaches);
        }
    }
    return {
        columns,
        left: farthestLeftOut < 0 ? -Infinity : cellRight(farthestLeftOut),
        right: last + 1 < count ? cellLeft(last + 1) : Infinity,
    };
}

/**
 * @param {!int} count
 * @param {!function(!int): !boolean} holds A test that is false up to some index and true from there on.
 * @returns {!int} That index, or count when the test never holds.
 */
function firstWhere(count, holds) {
    let low = 0;
    let high = count;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (holds(middle)) {
            high = middle;
        } else {
            low = middle + 1;
        }
    }
    return low;
}

export {columnsInRange};
