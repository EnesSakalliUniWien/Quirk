import { Suite, assertThat, assertTrue } from "../../../TestUtil.js";
import { Complex } from "../../../../src/engine/math/complex/Complex.js";
import { Matrix } from "../../../../src/engine/math/matrix/Matrix.js";
import { decohereMeasuredBitsInDensityMatrix } from "../../../../src/engine/math/matrix/densityMatrix.js";

const suite = new Suite("densityMatrix");

suite.test(
  "measurement removes only the measured coherences without changing the input",
  () => {
    // |+> on the high bit and (|0> + i|1>)/sqrt(2) on the low bit.
    const i = Complex.I;
    const minusI = i.neg();
    const state = Matrix.col(1, i, 1, i).times(0.5);
    const density = state.times(state.adjoint());
    const before = [...density.rawBuffer()];
    assertTrue(decohereMeasuredBitsInDensityMatrix(density, 0) === density);
    assertThat(decohereMeasuredBitsInDensityMatrix(density, 1)).isEqualTo(
      Matrix.square(1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1).times(0.25),
    );
    assertThat(decohereMeasuredBitsInDensityMatrix(density, 2)).isEqualTo(
      Matrix.square(
        1,
        minusI,
        0,
        0,
        i,
        1,
        0,
        0,
        0,
        0,
        1,
        minusI,
        0,
        0,
        i,
        1,
      ).times(0.25),
    );
    const both = decohereMeasuredBitsInDensityMatrix(density, 3);
    assertThat(both).isEqualTo(Matrix.identity(4).times(0.25));
    assertTrue(both.rawBuffer() instanceof Float32Array);
    assertThat([...density.rawBuffer()]).isEqualTo(before);
  },
);
