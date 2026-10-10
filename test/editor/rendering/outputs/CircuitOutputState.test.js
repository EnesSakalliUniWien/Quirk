import { Suite, assertThat } from "../../../TestUtil.js";
import { Matrix } from "../../../../src/engine/math/matrix/Matrix.js";
import {
  describeOutputState,
  outputStateAsMatrix,
} from "../../../../src/editor/rendering/outputs/CircuitOutputState.js";
import { CircuitDefinition } from "../../../../src/circuit/model/CircuitDefinition.js";

const suite = new Suite("CircuitOutputState");

suite.test(
  "display adaptation preserves amplitude ordering and omits temporary wires without altering simulation data",
  () => {
    const values = Float32Array.from({ length: 32 }, (_, i) => i / 32);
    const stats = {
      circuitDefinition: { numWires: 4 },
      finalState: new Matrix(1, 16, values),
    };
    const all = outputStateAsMatrix(stats, 4);
    const reduced = outputStateAsMatrix(stats, 3);
    assertThat([all.width(), all.height()]).isEqualTo([4, 4]);
    assertThat([reduced.width(), reduced.height()]).isEqualTo([2, 4]);
    assertThat([...reduced.rawBuffer()]).isEqualTo([...values.slice(0, 16)]);
    assertThat([...stats.finalState.rawBuffer()]).isEqualTo([...values]);
  },
);

suite.test(
  "the grid in words names the likeliest outcomes with their chances and phases, from its reference",
  () => {
    const half = Math.SQRT1_2;
    const definition = new CircuitDefinition(2, []);
    const state = (values) => ({
      circuitDefinition: { numWires: 2 },
      finalState: new Matrix(1, 4, Float32Array.from(values)),
    });
    // Two equal amplitudes: phases are measured from the first, so −i|11⟩ is a quarter turn back.
    assertThat(
      describeOutputState(
        definition,
        state([0, 0, half, 0, 0, 0, 0, -half]),
        2,
      ),
    ).isEqualTo(
      "Output state: |01⟩ 50.0%, |11⟩ 50.0% at −90°. Phases measured from |01⟩.",
    );
    // −|11⟩, as Y·Y leaves it, measured from itself.
    assertThat(
      describeOutputState(definition, state([0, 0, 0, 0, 0, 0, -1, 0]), 2, 1),
    ).isEqualTo(
      "State after operation 1: |11⟩ 100%. Phases measured from |11⟩.",
    );
    assertThat(
      describeOutputState(definition, state([1, 0, 0, 0, 0, 0, 0, 0]), 2, 0),
    ).isEqualTo(
      "State before the first operation: |00⟩ 100%. Phases measured from |00⟩.",
    );
    // A big register names the eight likeliest and counts the rest.
    const wide = {
      circuitDefinition: { numWires: 4 },
      finalState: new Matrix(
        1,
        16,
        Float32Array.from({ length: 32 }, (_, k) => (k % 2 === 0 ? 0.25 : 0)),
      ),
    };
    assertThat(
      describeOutputState(new CircuitDefinition(4, []), wide, 4).includes(
        ", and 8 more.",
      ),
    ).isEqualTo(true);
    const nan = {
      circuitDefinition: { numWires: 2 },
      finalState: new Matrix(
        1,
        4,
        Float32Array.from([NaN, 0, 0, 0, 0, 0, 0, 0]),
      ),
    };
    assertThat(describeOutputState(definition, nan, 2)).isEqualTo(
      "Output state: could not be worked out.",
    );
  },
);
