import {Suite,assertThat} from '../../TestUtil.js';
import {toMathFieldValue,toQuirkExpression} from '../../../src/components/math/math-field-value.js';
import {ComplexFormula} from '../../../src/engine/math/formula/ComplexFormula.js';
import {Complex} from '../../../src/engine/math/complex/Complex.js';
const suite = new Suite('Math field notation');
suite.test('round trips preserve Quirk grouping and operator precedence', () => {
    for (const text of ['3pi/4','2^3^2','-2^2','2^(-3)','1e-7','sin(pi/3)','cos(2)','tan(0.2)','acos(0.5)','asin(0.5)','atan(1)','ln(e)','sqrt(1/2)','exp(i*pi/4)','(1+i)/(1-i)']) {
        const formatted = toMathFieldValue(text);
        assertThat(formatted.ok).isEqualTo(true);
        const converted = toQuirkExpression(formatted.latex,{allowComplex:true});
        assertThat(converted.ok).isEqualTo(true);
        assertThat(ComplexFormula.parse(converted.text,{angleUnit:ComplexFormula.RADIANS})).isApproximatelyEqualTo(ComplexFormula.parse(text,{angleUnit:ComplexFormula.RADIANS}));
    }
});
suite.test('nested fractions and unsupported constructs', () => {
    const converted = toQuirkExpression(String.raw`\frac{\pi}{\frac{3}{2}}`);
    assertThat(converted.ok).isEqualTo(true);
    assertThat(ComplexFormula.parse(converted.text).real).isApproximatelyEqualTo(Math.PI/1.5);
    for (const text of [String.raw`\int_0^1 x`,String.raw`\text{hello}`,String.raw`\frac{1}{`, 'i', '1+'])
        assertThat(toQuirkExpression(text).ok).isEqualTo(false);
});
suite.test('keyboard constants convert and unfinished templates ask for completion', () => {
    const e = toQuirkExpression(String.raw`\exponentialE^{2}`);
    assertThat(e.ok).isEqualTo(true);
    assertThat(ComplexFormula.parse(e.text).real).isApproximatelyEqualTo(Math.E * Math.E);
    const i = toQuirkExpression(String.raw`2\imaginaryI`, {allowComplex:true});
    assertThat(i.ok).isEqualTo(true);
    assertThat(ComplexFormula.parse(i.text)).isApproximatelyEqualTo(new Complex(0, 2));
    assertThat(toQuirkExpression(String.raw`\imaginaryI`).error).isEqualTo('Angle must be real.');
    assertThat(toQuirkExpression(String.raw`\frac{1}{\placeholder{}}`).error).isEqualTo('Complete the expression.');
});
