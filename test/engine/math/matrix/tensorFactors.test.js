import {Suite, assertThat} from '../../../TestUtil.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {Complex} from '../../../../src/engine/math/complex/Complex.js';
import {tensorFactors} from '../../../../src/engine/math/matrix/tensorFactors.js';

const suite = new Suite('tensorFactors');
const product = (a,b) => Matrix.generate(a.width()*b.width(),a.height()*b.height(),(r,c) =>
    a.cell(Math.floor(c/b.width()),Math.floor(r/b.height())).times(b.cell(c%b.width(),r%b.height())));
const reconstruct = factors => factors.map(f=>f.matrix).reduce(product);

suite.test('local complex operators factor in high to low wire order and reconstruct every entry', () => {
    const h=Matrix.square(1,1,1,-1).times(Math.SQRT1_2);
    const phase=Matrix.square(1,0,0,new Complex(0,1));
    const matrix=product(phase,product(Matrix.identity(2),h)).times(new Complex(0,-1));
    const factors=tensorFactors(matrix);
    assertThat(factors.map(f=>f.firstWire)).isEqualTo([2,1,0]);
    assertThat(reconstruct(factors)).isApproximatelyEqualTo(matrix,1e-10);
});

suite.test('a Bell pair stays joint while an independent spectator factors out', () => {
    const bell=Matrix.col(Math.SQRT1_2,0,0,Math.SQRT1_2);
    assertThat(tensorFactors(bell).length).isEqualTo(1);
    const state=product(Matrix.col(0,1),bell);
    const factors=tensorFactors(state);
    assertThat(factors.map(f=>f.wireCount)).isEqualTo([1,2]);
    assertThat(reconstruct(factors)).isApproximatelyEqualTo(state,1e-10);
});

suite.test('controlled operations do not become local merely because their input is separable', () => {
    const cnot=Matrix.fromRows([[1,0,0,0],[0,1,0,0],[0,0,0,1],[0,0,1,0]]);
    assertThat(tensorFactors(cnot).length).isEqualTo(1);
    assertThat(tensorFactors(Matrix.col(1,0,0,0)).length).isEqualTo(2);
});

suite.test('zero and nonfinite data do not produce invented tensor factors', () => {
    assertThat(tensorFactors(Matrix.zero(4,4)).length).isEqualTo(1);
    assertThat(tensorFactors(Matrix.zero(4,4).times(NaN)).length).isEqualTo(1);
});
