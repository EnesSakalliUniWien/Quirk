import {toColumnSpaceCoordinate, wireIndexAt} from './CircuitHitTesting.js';
import {expandToWholeGates, occupiedColumns, rangeFromCells} from '../../circuit/circuitRange.js';

/**
 * The cells a box dragged across the circuit selects, and where a selection is drawn. The box
 * snaps to the cells nearest its corners and then grows to take in every gate it touches, so a
 * selection never cuts a gate in two.
 */

/**
 * @param {!CircuitGeometry} geometry
 * @param {!CircuitDefinition} definition
 * @param {!Point} pos
 * @returns {!{col: !int, row: !int}} The cell nearest the point, clamped into the circuit.
 */
function cellNearest(geometry, definition, pos) {
    const clamp = (v, max) => Math.max(0, Math.min(max, v));
    return {
        col: clamp(Math.round(toColumnSpaceCoordinate(geometry, pos.x)), occupiedColumns(definition) - 1),
        row: clamp(wireIndexAt(geometry, pos.y), definition.numWires - 1),
    };
}

/**
 * @param {!CircuitDefinition} definition
 * @param {!CircuitGeometry} geometry
 * @param {!Point} from Where the box started.
 * @param {!Point} to Where the box ends now.
 * @returns {undefined|!CircuitRange} Undefined when the circuit has no columns to select.
 */
function rangeBetween(definition, geometry, from, to) {
    if (occupiedColumns(definition) === 0) {
        return undefined;
    }
    return expandToWholeGates(definition, rangeFromCells(
        cellNearest(geometry, definition, from), cellNearest(geometry, definition, to)));
}

/**
 * @param {!CircuitGeometry} geometry
 * @param {!CircuitRange} range
 * @returns {!Rect} Where the selection is drawn: the range's gate slots, with a margin that keeps
 *     the outline clear of their hover rings.
 */
function selectionRect(geometry, {colStart, colEnd, wireStart, wireEnd}) {
    return geometry.gateRect(wireStart, colStart, colEnd - colStart, wireEnd - wireStart).paddedBy(6);
}

/**
 * @param {!CircuitGeometry} geometry
 * @param {!Point} pos
 * @returns {!{col: !int, row: !int}} Where a paste at the point goes: before the column under it,
 *     from the wire under it. Unclamped; the paste keeps it inside the circuit.
 */
function insertionCellAt(geometry, pos) {
    return {
        col: Math.max(0, Math.round(toColumnSpaceCoordinate(geometry, pos.x))),
        row: Math.max(0, wireIndexAt(geometry, pos.y)),
    };
}

export {insertionCellAt, rangeBetween, selectionRect};
