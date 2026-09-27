import {Suite, assertThat} from "../TestUtil.js"
import {CircuitDefinition} from "../../src/circuit/model/CircuitDefinition.js"
import {GateBuilder} from "../../src/circuit/model/Gate.js"
import {GateColumn} from "../../src/circuit/model/GateColumn.js"
import {Matrix} from "../../src/engine/math/matrix/Matrix.js"
import {Serializer} from "../../src/serialization/Serializer.js"
import {
    expandToWholeGates, gatesMeetingRange, occupiedColumns, outsideDependencies, rangeFromCells, sliceCircuit,
} from "../../src/circuit/circuitRange.js"

const suite = new Suite("circuitRange");

const fromJson = json => Serializer.fromJson(CircuitDefinition, json);
const tall = new GateBuilder().setSerializedIdAndSymbol("T").setHeight(2).setKnownEffectToMatrix(Matrix.identity(4)).gate;
const wide = new GateBuilder().setSerializedIdAndSymbol("W").setWidth(2).setKnownEffectToMatrix(Matrix.identity(2)).gate;

suite.test("a range is the rectangle between two cells, whichever corner comes first", () => {
    assertThat(rangeFromCells({col: 3, row: 0}, {col: 1, row: 2})).isEqualTo({colStart: 1, colEnd: 4, wireStart: 0, wireEnd: 3});
    assertThat(rangeFromCells({col: 2, row: 1}, {col: 2, row: 1})).isEqualTo({colStart: 2, colEnd: 3, wireStart: 1, wireEnd: 2});
});

suite.test("a wide gate's end counts as an occupied column", () => {
    const circuit = new CircuitDefinition(2, [new GateColumn([wide, undefined])]);
    assertThat(circuit.columns.length).isEqualTo(1);
    assertThat(occupiedColumns(circuit)).isEqualTo(2);
    assertThat(occupiedColumns(new CircuitDefinition(2, []))).isEqualTo(0);
});

suite.test("gates meeting a range say whether all of them is inside", () => {
    const circuit = new CircuitDefinition(3, [new GateColumn([tall, undefined, undefined]), new GateColumn([undefined, undefined, wide])]);
    const met = gatesMeetingRange(circuit, {colStart: 0, colEnd: 2, wireStart: 1, wireEnd: 3});
    assertThat(met.map(({col, row, inside}) => ({col, row, inside}))).isEqualTo([
        {col: 0, row: 0, inside: false},
        {col: 1, row: 2, inside: false},
    ]);
    assertThat(gatesMeetingRange(circuit, {colStart: 0, colEnd: 3, wireStart: 0, wireEnd: 3}).every(e => e.inside)).isEqualTo(true);
});

suite.test("a range grows until it cuts no gate, taking in what the growing reaches", () => {
    // The tall gate takes the range up a wire, where the wide gate starts in the next column.
    const circuit = new CircuitDefinition(2, [
        new GateColumn([tall, undefined]),
        new GateColumn([wide, undefined]),
        new GateColumn([undefined, undefined]),
    ]);
    assertThat(expandToWholeGates(circuit, {colStart: 0, colEnd: 2, wireStart: 1, wireEnd: 2})).
        isEqualTo({colStart: 0, colEnd: 3, wireStart: 0, wireEnd: 2});
    // A range cutting nothing stays as it is.
    assertThat(expandToWholeGates(circuit, {colStart: 1, colEnd: 3, wireStart: 0, wireEnd: 1})).
        isEqualTo({colStart: 1, colEnd: 3, wireStart: 0, wireEnd: 1});
});

suite.test("a slice keeps the range's gates, its first cell as the slice's first, and drops cut gates", () => {
    const circuit = fromJson({cols: [["H", "X", "Z"], ["•", "Y"], [1, 1, "H"]]});
    const slice = sliceCircuit(circuit, {colStart: 0, colEnd: 2, wireStart: 1, wireEnd: 3});
    assertThat(Serializer.toJson(slice)).isEqualTo({cols: [["X", "Z"], ["Y"]]});
    assertThat(slice.numWires).isEqualTo(2);

    const withTall = new CircuitDefinition(3, [new GateColumn([undefined, tall, undefined])]);
    assertThat(sliceCircuit(withTall, {colStart: 0, colEnd: 1, wireStart: 0, wireEnd: 2}).columns[0].gates).
        isEqualTo([undefined, undefined]);

    // A wide gate at the end of the circuit reaches past its last column, and the slice pads for it.
    const withWide = new CircuitDefinition(1, [new GateColumn([wide])]);
    const padded = sliceCircuit(withWide, {colStart: 0, colEnd: 2, wireStart: 0, wireEnd: 1});
    assertThat(padded.columns.length).isEqualTo(2);
    assertThat(padded.columns[0].gates[0]).isEqualTo(wide);
});

suite.test("outside dependencies name the controls, swap halves and inputs a copy leaves behind", () => {
    const controlled = fromJson({cols: [["•", "X"], ["H", "Z"]]});
    assertThat(outsideDependencies(controlled, {colStart: 0, colEnd: 2, wireStart: 1, wireEnd: 2}).
        map(({kind, col, row}) => ({kind, col, row}))).isEqualTo([{kind: "control", col: 0, row: 0}]);
    // Selecting the control alone takes nothing from outside.
    assertThat(outsideDependencies(controlled, {colStart: 0, colEnd: 1, wireStart: 0, wireEnd: 1})).isEqualTo([]);

    const swapped = fromJson({cols: [["Swap", "Swap"]]});
    assertThat(outsideDependencies(swapped, {colStart: 0, colEnd: 1, wireStart: 0, wireEnd: 1}).
        map(({kind, row}) => ({kind, row}))).isEqualTo([{kind: "swap", row: 1}]);

    const arithmetic = fromJson({cols: [["inputA1", "+=A1"]]});
    assertThat(outsideDependencies(arithmetic, {colStart: 0, colEnd: 1, wireStart: 1, wireEnd: 2}).
        map(({kind}) => kind)).isEqualTo(["input"]);
    assertThat(outsideDependencies(arithmetic, {colStart: 0, colEnd: 1, wireStart: 0, wireEnd: 2})).isEqualTo([]);
});
