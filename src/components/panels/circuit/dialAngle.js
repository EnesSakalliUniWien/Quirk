/**
 * The dial's arithmetic, kept apart from its drawing: what one turn of the dial does to an angle,
 * and how an angle it chose is written into the gate's own parameter language.
 */

/** @type {!number} One notch of the dial, in degrees; a held shift key coarsens it to a detent. */
export const DIAL_STEP = 1;
/** @type {!number} The detent a held shift key snaps to, in degrees: an eighth of a turn. */
export const DIAL_DETENT = 15;

/**
 * @param {!number} degrees
 * @param {!number} step
 * @returns {!number} The angle moved to the nearest multiple of the step, so a coarse drag lands
 *     on the detents rather than near them.
 */
export function snapAngle(degrees, step) {
    return Math.round(degrees / step) * step;
}

/**
 * @param {!number} degrees
 * @param {!number} direction +1 or -1: which way the dial turned.
 * @param {!boolean} coarse Whether the turn is by detents rather than notches.
 * @returns {!number} The next stop the dial rests at.
 */
export function stepAngle(degrees, direction, coarse) {
    const step = coarse ? DIAL_DETENT : DIAL_STEP;
    // From between two stops, a turn goes to the nearest stop in its own direction.
    const at = degrees / step;
    const next = direction > 0 ? Math.floor(at + 1e-9) + 1 : Math.ceil(at - 1e-9) - 1;
    return next * step;
}

/**
 * @param {!number} a
 * @param {!number} b
 * @returns {!number}
 */
function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}

/**
 * @param {!number} degrees
 * @returns {!string} The angle as an exact radians formula in the gate's language: 90 is pi/2,
 *     135 is 3pi/4, and a degree count that divides no further is written over 180.
 */
export function radiansExpression(degrees) {
    const rounded = Math.round(degrees * 1000) / 1000;
    if (rounded === 0) {
        return '0';
    }
    if (!Number.isInteger(rounded)) {
        return `${rounded}pi/180`;
    }
    const sign = rounded < 0 ? '-' : '';
    const divisor = gcd(Math.abs(rounded), 180);
    const numerator = Math.abs(rounded) / divisor;
    const denominator = 180 / divisor;
    const top = numerator === 1 ? 'pi' : `${numerator}pi`;
    return denominator === 1 ? `${sign}${top}` : `${sign}${top}/${denominator}`;
}

/**
 * @param {!number} degrees
 * @returns {!string} The readout under the dial: whole degrees, or one decimal when there is one.
 */
export function readoutDegrees(degrees) {
    const rounded = Math.round(degrees * 10) / 10;
    return `${rounded}°`;
}

/**
 * @param {!number} degrees
 * @returns {!string} The readout's second part, in turns of π: 90° reads π/2.
 */
export function readoutRadians(degrees) {
    return radiansExpression(degrees).replaceAll('pi', 'π');
}
