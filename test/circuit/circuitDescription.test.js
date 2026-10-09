import {Suite, assertThat} from "../TestUtil.js"
import {CircuitDefinition} from "../../src/circuit/model/CircuitDefinition.js"
import {Serializer} from "../../src/serialization/Serializer.js"
import {describeCell, describeCircuit, gateCovering, gateLabel} from "../../src/circuit/circuitDescription.js"

const suite = new Suite("circuitDescription");

const fromJson = json => Serializer.fromJson(CircuitDefinition, json);

suite.test("a circuit is described by its size and its gates", () => {
    assertThat(describeCircuit(fromJson({cols: []}))).isEqualTo("Empty circuit, 2 wires.");
    assertThat(describeCircuit(fromJson({cols: [["H"], ["•", "X"]]}))).isEqualTo("2 wires, 2 columns, 3 gates.");
    assertThat(describeCircuit(fromJson({cols: [["X"]]}))).isEqualTo("2 wires, 1 column, 1 gate.");
});

suite.test("a cell says where it is and what is in it", () => {
    const circuit = fromJson({cols: [["H"], [{id: "X", off: true}, "Swap"], [1, "Swap"]]});
    assertThat(describeCell(circuit, {col: 0, row: 0})).isEqualTo(`Wire 1, column 1: ${gateLabel(circuit.columns[0].gates[0])}`);
    assertThat(describeCell(circuit, {col: 0, row: 1})).isEqualTo("Wire 2, column 1: empty");
    assertThat(describeCell(circuit, {col: 1, row: 0}).endsWith(" (off)")).isEqualTo(true);
    // Just under the last wire, a gate put down adds a wire.
    assertThat(describeCell(circuit, {col: 3, row: 2})).isEqualTo("New wire 3, column 4: empty");
});

suite.test("a cell a larger gate covers names where that gate starts", () => {
    const circuit = fromJson({cols: [["QFT2"]]});
    assertThat(gateCovering(circuit, {col: 0, row: 1})?.row).isEqualTo(0);
    assertThat(describeCell(circuit, {col: 0, row: 1}).endsWith(", part of the gate at wire 1, column 1")).isEqualTo(true);
    assertThat(gateCovering(circuit, {col: 1, row: 0})).isEqualTo(undefined);
});
