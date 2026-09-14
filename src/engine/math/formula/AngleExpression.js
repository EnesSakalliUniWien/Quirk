import {ComplexFormula} from './ComplexFormula.js';

/** Parse a complete, constant angle without changing the formula language used by saved gates. */
export function parseAngleExpression(text, unit = 'radians') {
    if (!['radians', 'degrees'].includes(unit)) throw new Error('Choose radians or degrees.');
    if (!text.trim()) throw new Error('Enter an angle.');
    if (/[+*/^-]\s*$/.test(text)) throw new Error('Complete the angle expression.');
    let result;
    try {
        result = ComplexFormula.parse(text, {angleUnit: unit === 'radians' ? ComplexFormula.RADIANS : ComplexFormula.DEGREES});
    } catch {
        throw new Error('Enter a constant expression, such as pi/3 or 60.');
    }
    if (!Number.isFinite(result.real) || !Number.isFinite(result.imag)) throw new Error('Angle must be finite.');
    if (Math.abs(result.imag) > 0.0001) throw new Error('Angle must be real.');
    const radians = unit === 'radians' ? result.real : result.real * Math.PI / 180;
    const degrees = unit === 'degrees' ? result.real : result.real * 180 / Math.PI;
    if (!Number.isFinite(radians) || !Number.isFinite(degrees)) throw new Error('Angle is too large.');
    return {value: result.real, radians, degrees};
}
