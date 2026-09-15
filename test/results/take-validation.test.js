import { Suite, assertThat, assertTrue, assertThrows } from "../TestUtil.js";
import { Serializer } from "../../src/serialization/Serializer.js";
import { CircuitDefinition } from "../../src/circuit/model/CircuitDefinition.js";
import { CircuitStats } from "../../src/engine/simulation/CircuitStats.js";
import { Simulator } from "../../src/app/state/Simulator.js";
import { createTake, restoreTake } from "../../src/results/take/snapshot.js";
import { validateTake } from "../../src/results/take/validation.js";
import { parseTakes } from "../../src/results/files/json.js";

const suite = new Suite("Take validation regressions");
const circuit = cols => Serializer.fromJson(CircuitDefinition, { cols });
const make = (cols, wires) => {
  const definition = circuit(cols);
  return createTake(new Simulator().evaluate(definition, wires ?? definition.numWires, cols.length));
};

suite.test("null imports report a validation error", () => {
  const error = assertThrows(() => parseTakes("null")).subject;
  assertThat(error.name).isEqualTo("Error");
  assertTrue(error.message.includes("Invalid take"));
});

suite.testUsingWebGL("all unused-wire padding must be numeric zero", () => {
  const take = make([["H"]], 3);
  for (const field of ["result", "fullResult"]) {
    for (const value of [1, { unavailable: "NaN" }]) {
      const bad = structuredClone(take);
      bad[field].amplitudes[8] = value;
      assertThrows(() => validateTake(bad));
    }
  }
});

suite.testUsingWebGL("display locations must be enabled and canonical", () => {
  const take = make([["H"], ["Chance2"]]);
  for (const field of ["result", "fullResult"]) {
    const bad = structuredClone(take);
    bad[field].custom.push(["01:0", structuredClone(bad[field].custom[0][1])]);
    assertThrows(() => validateTake(bad));
    const disabled = make([["Chance2", "•"]]);
    disabled[field].custom.push(["0:0", {kind: "matrix", width: 1, height: 4, buffer: [1,0,0,0,0,0,0,0]}]);
    assertThrows(() => validateTake(disabled));
  }
});

suite.testUsingWebGL("amplitude displays preserve the simulator matrix layout", () => {
  const take = make([["H"], ["Amps2"]]);
  for (const field of ["result", "fullResult"]) {
    for (const name of ["ket", "incoherentKet"]) {
      const bad = structuredClone(take);
      bad[field].custom[0][1][name].width = 1;
      bad[field].custom[0][1][name].height = 4;
      assertThrows(() => validateTake(bad));
    }
  }
});

suite.test("unavailable histories must match CircuitStats fallback", () => {
  const definition = circuit([["H"]]);
  const stats = CircuitStats.withNanDataFromCircuitAtTime(definition.withMinimumWireCount(), 0);
  const take = createTake({circuit: definition, wireCount: 3, step: 1, phase: 0, seed: "test", stats, fullStats: stats});
  assertThat(validateTake(take)).isEqualTo(take);
  for (const field of ["result", "fullResult"]) {
    const bad = structuredClone(take);
    bad[field].survival = [0,1,2];
    assertThrows(() => validateTake(bad));
  }
});

suite.testUsingWebGL("restored Sample outcomes do not alias the stored take", () => {
  const take = make([["H"], ["Sample1"]]);
  const original = take.result.samples["1:0"].i;
  restoreTake(take).stats.sampleOutcomes["1:0"].i = 999;
  assertThat(take.result.samples["1:0"].i).isEqualTo(original);
});
