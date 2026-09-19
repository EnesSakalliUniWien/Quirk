import {Suite, assertThat} from "../../TestUtil.js"
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js"
import {Complex} from "../../../src/engine/math/complex/Complex.js"
import {isEntangled, isState, isSuperposition, pureStateOf} from "../../../src/gates/assertions/assertionVerdicts.js"

const suite = new Suite("assertionVerdicts");

const s = Math.SQRT1_2;
/** @param {...!number} amplitudes A pure state's, wire 0 the lowest bit. @returns {!Matrix} */
const pure = (...amplitudes) => {
    const ket = Matrix.col(...amplitudes);
    return ket.times(ket.adjoint());
};

suite.test("a superposition has more than one basis state with a chance", () => {
    assertThat(isSuperposition(pure(1, 0))).isEqualTo(false);
    assertThat(isSuperposition(pure(0, 0, 0, 1))).isEqualTo(false);
    assertThat(isSuperposition(pure(s, s))).isEqualTo(true);
    assertThat(isSuperposition(pure(s, 0, 0, -s))).isEqualTo(true);
    // The phase does not matter, and neither does whether the state is pure.
    assertThat(isSuperposition(Matrix.square(0.5, 0, 0, 0.5))).isEqualTo(true);
});

suite.test("entangled wires are not the product of their own states", () => {
    assertThat(isEntangled(pure(s, 0, 0, s), 2)).isEqualTo(true);
    assertThat(isEntangled(pure(0, s, -s, 0), 2)).isEqualTo(true);
    // |+>|+> and |0>|1> are products.
    assertThat(isEntangled(pure(0.5, 0.5, 0.5, 0.5), 2)).isEqualTo(false);
    assertThat(isEntangled(pure(0, 0, 1, 0), 2)).isEqualTo(false);
});

suite.test("an entanglement assertion asks it of every two of its wires", () => {
    // GHZ: every pair agrees.
    assertThat(isEntangled(pure(s, 0, 0, 0, 0, 0, 0, s), 3)).isEqualTo(true);
    // A Bell pair on wires 0 and 1 beside a lone wire 2.
    assertThat(isEntangled(pure(s, 0, 0, s, 0, 0, 0, 0), 3)).isEqualTo(false);
});

suite.test("a state equals the claimed one up to a global phase, and no other", () => {
    const plusI = pure(s, new Complex(0, s));
    assertThat(isState(plusI, [[s, 0], [0, s]])).isEqualTo(true);
    // The same state with the global phase i.
    assertThat(isState(plusI, [[0, s], [-s, 0]])).isEqualTo(true);
    // |-i> is orthogonal to it, and |+> half way.
    assertThat(isState(plusI, [[s, 0], [0, -s]])).isEqualTo(false);
    assertThat(isState(plusI, [[s, 0], [s, 0]])).isEqualTo(false);
    // A mixture is no pure state.
    assertThat(isState(Matrix.square(0.5, 0, 0, 0.5), [[1, 0], [0, 0]])).isEqualTo(false);
});

suite.test("the pure state of the wires is read back from their density matrix", () => {
    assertThat(pureStateOf(pure(s, new Complex(0, s)))).isApproximatelyEqualTo([[s, 0], [0, s]], 0.0001);
    // Its largest amplitude comes out real and positive.
    assertThat(pureStateOf(pure(0, 0, new Complex(0, -1), 0))).isApproximatelyEqualTo([[0, 0], [0, 0], [1, 0], [0, 0]], 0.0001);
    assertThat(pureStateOf(Matrix.square(0.5, 0, 0, 0.5))).isEqualTo(undefined);
});
