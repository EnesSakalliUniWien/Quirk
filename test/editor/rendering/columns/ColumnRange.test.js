import {Suite, assertThat} from '../../../TestUtil.js';
import {columnsInRange} from '../../../../src/editor/rendering/columns/ColumnRange.js';
import {CircuitDefinition} from '../../../../src/circuit/model/CircuitDefinition.js';
import {GateColumn} from '../../../../src/circuit/model/GateColumn.js';
import {CircuitViewState} from '../../../../src/editor/state/CircuitViewState.js';
import {DensityMatrixDisplayFamily} from '../../../../src/gates/displays/density/DensityMatrixDisplay.js';
import {CircuitGeometry} from '../../../../src/editor/geometry/CircuitGeometry.js';
import {Layout} from '../../../../src/config/Layout.js';
import {Gates} from '../../../../src/gates/AllGates.js';

const suite = new Suite('ColumnRange');

const HALF = Layout.COLUMN_SPACING / 2;

/** @returns {!{definition: !CircuitDefinition, geometry: !CircuitGeometry, centre: !function(!int): !number}} */
function circuitOf(columns, wires = 3) {
    const definition = new CircuitDefinition(wires, columns);
    const geometry = CircuitViewState.empty(0).withCircuit(definition).geometry();
    return {definition, geometry, centre: col => geometry.opRect(col).center().x};
}

const hadamards = count => Array.from({length: count}, () => new GateColumn([Gates.HalfTurns.H, undefined, undefined]));

suite.test('a range takes the columns whose cells touch it, and says how far a view may go before another shows', () => {
    const {definition, geometry, centre} = circuitOf(hadamards(20));
    const result = columnsInRange(definition, geometry, {left: centre(5), right: centre(8)});
    assertThat(result.columns).isEqualTo([5, 6, 7, 8]);
    // Left of column 5 stands column 4's cell, which ends where column 5's begins; right of column 8, column 9's.
    assertThat(result.left).isEqualTo(centre(4) + HALF);
    assertThat(result.right).isEqualTo(centre(9) - HALF);

    // A range inside one column's cell takes that column alone.
    assertThat(columnsInRange(definition, geometry, {left: centre(7) - 5, right: centre(7) + 5}).columns)
        .isEqualTo([7]);
});

suite.test('a range that reaches past the circuit leaves nothing out on that side', () => {
    const {definition, geometry, centre} = circuitOf(hadamards(20));
    const start = columnsInRange(definition, geometry, {left: -500, right: centre(2)});
    assertThat(start.columns).isEqualTo([0, 1, 2]);
    assertThat(start.left).isEqualTo(-Infinity);
    const end = columnsInRange(definition, geometry, {left: centre(17), right: centre(19) + 5000});
    assertThat(end.columns).isEqualTo([17, 18, 19]);
    assertThat(end.right).isEqualTo(Infinity);
    // And one that takes all of it limits nothing: no scroll needs a column that is not there.
    const all = columnsInRange(definition, geometry, {left: -500, right: centre(19) + 5000});
    assertThat(all.columns.length).isEqualTo(20);
    assertThat([all.left, all.right]).isEqualTo([-Infinity, Infinity]);
});

suite.test('a range off either end of the circuit takes no column, and without a range every column is taken', () => {
    const {definition, geometry, centre} = circuitOf(hadamards(10));
    const before = columnsInRange(definition, geometry, {left: -900, right: -500});
    assertThat(before.columns).isEqualTo([]);
    assertThat(before.right).isEqualTo(centre(0) - HALF);
    const past = columnsInRange(definition, geometry, {left: centre(9) + 900, right: centre(9) + 1500});
    assertThat(past.columns).isEqualTo([]);
    assertThat(past.left).isEqualTo(centre(9) + HALF);

    const everything = columnsInRange(definition, geometry, undefined);
    assertThat(everything.columns).isEqualTo([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assertThat([everything.left, everything.right]).isEqualTo([-Infinity, Infinity]);

    const empty = circuitOf([]);
    const none = columnsInRange(empty.definition, empty.geometry, {left: 0, right: 100});
    assertThat([none.columns, none.left, none.right]).isEqualTo([[], -Infinity, Infinity]);
});

suite.test('a gate spanning columns keeps its column while any column it covers is in the range', () => {
    const wide = DensityMatrixDisplayFamily.ofSize(3);
    assertThat(wide.width).isEqualTo(3);
    const columns = hadamards(10);
    columns[2] = new GateColumn([wide, undefined, undefined]);
    const {definition, geometry, centre} = circuitOf(columns);

    // The gate starts in column 2 and covers 3 and 4: a range that begins in column 4 still draws it.
    const inLastCovered = columnsInRange(definition, geometry, {left: centre(4), right: centre(5)});
    assertThat(inLastCovered.columns).isEqualTo([2, 4, 5]);
    // Past its last column it is gone, and so is the column's cell from the view's reach.
    const past = columnsInRange(definition, geometry, {left: centre(5), right: centre(6)});
    assertThat(past.columns).isEqualTo([5, 6]);
    assertThat(past.left).isEqualTo(centre(4) + HALF);
    // The view may not go left of the cell where the gate ends, nor, here, of what else is left out.
    assertThat(inLastCovered.left).isEqualTo(centre(3) + HALF);
});

suite.test('a control line crossing the edge of the range keeps its column', () => {
    const columns = hadamards(10);
    columns[6] = new GateColumn([Gates.Controls.Control, undefined, Gates.HalfTurns.X]);
    const {definition, geometry, centre} = circuitOf(columns);
    // The range's edge is right of the control's line, which stands on the column's centre, and left of
    // the column's other edge: the column is still the one whose gate the range reaches.
    const crossing = columnsInRange(definition, geometry, {left: centre(6) + 10, right: centre(8)});
    assertThat(crossing.columns).isEqualTo([6, 7, 8]);
    const before = columnsInRange(definition, geometry, {left: centre(2), right: centre(6) - 10});
    assertThat(before.columns).isEqualTo([2, 3, 4, 5, 6]);
});

suite.test('the columns pinched shut by a drag still move right as they go, so bisecting finds them', () => {
    const definition = new CircuitDefinition(3, hadamards(12));
    const pinched = new CircuitGeometry(0, definition, 4, undefined, 0);
    const centre = col => pinched.opRect(col).center().x;
    for (const [from, to] of [[0, 3], [3, 5], [4, 4], [6, 11]]) {
        const result = columnsInRange(definition, pinched, {left: centre(from), right: centre(to)});
        const expected = [];
        for (let col = 0; col < 12; col++) {
            if (centre(col) + HALF >= centre(from) && centre(col) - HALF <= centre(to)) expected.push(col);
        }
        assertThat(result.columns).isEqualTo(expected);
    }
});
