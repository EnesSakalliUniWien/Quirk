import {Suite, assertThat} from "../../TestUtil.js"
import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js"
import {CircuitStats} from "../../../src/engine/simulation/CircuitStats.js"
import {Serializer} from "../../../src/serialization/Serializer.js"
import {failingAssertionColumns} from "../../../src/gates/assertions/AssertionGates.js"

const suite = new Suite("AssertionGates");

const statsOf = cols => CircuitStats.fromCircuitAtTime(Serializer.fromJson(CircuitDefinition, {cols}), 0);

suite.testUsingWebGL("an assertion judges the state at its own column and leaves it alone", () => {
    const stats = statsOf([["assert-sup1"], ["H"], ["assert-sup1"], ["•", "X"], ["assert-ent2"]]);
    assertThat(stats.customStatsForSlot(0, 0).holds).isEqualTo(false);
    assertThat(stats.customStatsForSlot(2, 0).holds).isEqualTo(true);
    assertThat(stats.customStatsForSlot(4, 0).holds).isEqualTo(true);
    assertThat(failingAssertionColumns(stats)).isEqualTo([0]);

    const s = Math.SQRT1_2;
    assertThat(stats.finalState.rawBuffer()).isApproximatelyEqualTo(new Float32Array([s, 0, 0, 0, 0, 0, s, 0]), 0.0001);
});

suite.testUsingWebGL("assertions survive a round trip and report their verdict as JSON", () => {
    const json = {cols: [["H"], ["assert-ent2"]]};
    const circuit = Serializer.fromJson(CircuitDefinition, json);
    assertThat(Serializer.toJson(circuit)).isEqualTo(json);
    const stats = CircuitStats.fromCircuitAtTime(circuit, 0);
    assertThat(failingAssertionColumns(stats)).isEqualTo([1]);
});

suite.testUsingWebGL("an equality assertion holds for its claimed state, whatever the global phase", () => {
    const s = Math.SQRT1_2;
    // S·H|0> is (|0> + i|1>)/sqrt(2); the claim on the second column carries a global phase of i.
    const stats = statsOf([
        ["H"], ["Z^½"],
        [{id: "assert-eq1", arg: [[s, 0], [0, s]]}],
        [{id: "assert-eq1", arg: [[0, s], [-s, 0]]}],
        [{id: "assert-eq1", arg: [[s, 0], [0, -s]]}],
        ["assert-eq1"],
    ]);
    assertThat([2, 3, 4, 5].map(col => stats.customStatsForSlot(col, 0).holds)).isEqualTo([true, true, false, false]);
    assertThat(failingAssertionColumns(stats)).isEqualTo([4, 5]);
});
