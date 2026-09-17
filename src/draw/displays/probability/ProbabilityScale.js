/**
 * How a probability is written and how long its bar is, shared by the Chance displays, the
 * Probabilities panel and the tape's distributions.
 */

/**
 * At or below this a probability is shown as exactly zero. Single-precision simulation leaves
 * about 1e-14 where an outcome is impossible, so this keeps round-off from reading as a possible
 * outcome while a chance of one in a billion still shows.
 */
export const ZERO_PROBABILITY = 1e-9;

/**
 * Within this of one a probability is shown as certain. Near one, single precision only resolves
 * steps of about 6e-8, so a certain outcome can come back as 0.99999994; a small chance near zero
 * keeps full precision, which is why this gap is wider than ZERO_PROBABILITY.
 */
const CERTAIN_GAP = 1e-6;

/**
 * @param {!number} p
 * @param {!int} digits Decimals of the percentage.
 * @returns {!string} The percentage, which never rounds a possible outcome to 0% or an uncertain
 *     one to 100%: those read "<0.1%" and ">99.9%" instead.
 */
export function formatProbability(p, digits = 1) {
    if (Number.isNaN(p)) {
        return "NaN";
    }
    if (p <= ZERO_PROBABILITY) {
        return "0%";
    }
    if (p >= 1 - CERTAIN_GAP) {
        return "100%";
    }
    const step = 10 ** -digits;
    const percent = p * 100;
    if (percent < step / 2) {
        return `<${step.toFixed(digits)}%`;
    }
    if (percent > 100 - step / 2) {
        return `>${(100 - step).toFixed(digits)}%`;
    }
    return percent.toFixed(digits) + "%";
}

/**
 * A bar's length as a fraction of the longest. It is the square root of the probability relative
 * to the largest, as an amplitude disc's radius is, so a small chance keeps a visible bar while the
 * order of the bars stays that of the probabilities.
 *
 * @param {!number} p
 * @param {!number} largest The probability a full bar stands for.
 * @returns {!number}
 */
export function probabilityBarFraction(p, largest) {
    if (!(p > ZERO_PROBABILITY) || !(largest > 0)) {
        return 0;
    }
    return Math.min(1, Math.sqrt(p / largest));
}

/**
 * @param {!Matrix} probabilities A column whose real parts are the probabilities.
 * @returns {!number} The largest of them, or 0 when there are none.
 */
export function largestProbability(probabilities) {
    const buffer = probabilities.rawBuffer();
    let largest = 0;
    for (let i = 0; i < buffer.length; i += 2) {
        if (buffer[i] > largest) {
            largest = buffer[i];
        }
    }
    return largest;
}
