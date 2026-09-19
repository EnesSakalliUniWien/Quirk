import {Suite, assertThat} from "../TestUtil.js"
import {CircuitDefinition} from "../../src/circuit/model/CircuitDefinition.js"
import {Serializer} from "../../src/serialization/Serializer.js"
import {alignColumns} from "../../src/circuit/columnAlignment.js"

const suite = new Suite("columnAlignment");

const columnsOf = cols => Serializer.fromJson(CircuitDefinition, {cols}).columns;
const aligned = (before, after) => [...alignColumns(columnsOf(before), columnsOf(after)).entries()];

suite.test("an inserted or removed column shifts the columns after it", () => {
    assertThat(aligned([['H'], ['X'], ['Z']], [['H'], ['Y'], ['X'], ['Z']])).isEqualTo([[0, 0], [1, 2], [2, 3]]);
    assertThat(aligned([['H'], ['X'], ['Z']], [['H'], ['Z']])).isEqualTo([[0, 0], [2, 1]]);
    assertThat(aligned([['H'], ['X'], ['Z']], [['X'], ['Z']])).isEqualTo([[1, 0], [2, 1]]);
});

suite.test("a column edited in place keeps its place", () => {
    assertThat(aligned([['H'], ['X'], ['Z']], [['H'], ['X', 'Y'], ['Z']])).isEqualTo([[0, 0], [1, 1], [2, 2]]);
    // Edited and shifted at once: the edited column is paired within its gap.
    assertThat(aligned([['H'], ['X'], ['Z']], [['Y'], ['H'], ['X', 'Y'], ['Z']])).isEqualTo([[0, 1], [1, 2], [2, 3]]);
    // Two changed for one: only the first pairs up.
    assertThat(aligned([['H'], ['X'], ['Y'], ['Z']], [['H'], ['Swap', 'Swap'], ['Z']])).isEqualTo([[0, 0], [1, 1], [3, 2]]);
});

suite.test("equal columns match in order, and an emptied circuit keeps nothing", () => {
    assertThat(aligned([['H'], ['H'], ['H']], [['H'], ['H']])).isEqualTo([[0, 0], [1, 1]]);
    assertThat(aligned([['H'], ['X']], [])).isEqualTo([]);
    assertThat(aligned([], [['H']])).isEqualTo([]);
});
