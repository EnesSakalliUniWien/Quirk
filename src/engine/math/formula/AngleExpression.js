import {ComplexFormula} from './ComplexFormula.js';

/** The units an angle is entered in: the formula language's own angle units. */
export const AngleUnit = Object.freeze({RADIANS: ComplexFormula.RADIANS, DEGREES: ComplexFormula.DEGREES});

/** Parse a complete, constant angle without changing the formula language used by saved gates. */
export function parseAngleExpression(text, unit = AngleUnit.RADIANS) {
    if (!Object.values(AngleUnit).includes(unit)) throw new Error('Choose radians or degrees.');
    if (!text.trim()) throw new Error('Enter an angle.');
    if (/[+*/^-]\s*$/.test(text)) throw new Error('Complete the angle expression.');
    let result;
    try {
        result = ComplexFormula.parse(text, {angleUnit: unit});
    } catch {
        throw new Error('Enter a constant expression, such as pi/3 or 60.');
    }
    if (!Number.isFinite(result.real) || !Number.isFinite(result.imag)) throw new Error('Angle must be finite.');
    if (Math.abs(result.imag) > 0.0001) throw new Error('Angle must be real.');
    const radians = unit === AngleUnit.RADIANS ? result.real : result.real * Math.PI / 180;
    const degrees = unit === AngleUnit.DEGREES ? result.real : result.real * 180 / Math.PI;
    if (!Number.isFinite(radians) || !Number.isFinite(degrees)) throw new Error('Angle is too large.');
    return {value: result.real, radians, degrees};
}
