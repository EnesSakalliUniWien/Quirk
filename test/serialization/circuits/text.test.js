import { Suite, assertThat, assertThrows, assertTrue } from "../../TestUtil.js";
import { fromJsonText_CircuitDefinition } from "../../../src/serialization/circuits/text.js";

const suite = new Suite("Circuit JSON text cache");

suite.test("failed parses never return the previously cached circuit", () => {
  const valid = '{"cols":[["H"]]}';
  const previous = fromJsonText_CircuitDefinition(valid);
  for (const invalid of ['{"cols":', '{"cols":false}']) {
    assertThrows(() => fromJsonText_CircuitDefinition(invalid));
    assertThrows(() => fromJsonText_CircuitDefinition(invalid));
    assertTrue(fromJsonText_CircuitDefinition(valid) === previous);
  }
});

suite.test("successful parses cache one text and replace it for a new circuit", () => {
  const first = fromJsonText_CircuitDefinition('{"cols":[["X"]]}');
  assertTrue(fromJsonText_CircuitDefinition('{"cols":[["X"]]}') === first);
  const second = fromJsonText_CircuitDefinition('{"cols":[["Y"]]}');
  assertThat(second.columns[0].gates[0].serializedId).isEqualTo("Y");
  assertTrue(second !== first);
});
