import {Matrix} from '../../../engine/math/matrix/Matrix.js';

/**
 * How far a joint probability may stray from the product of two parts' marginals while the parts
 * still count as independent. Single-precision simulation leaves round-off far below this, and a
 * correlation this small cannot change a shown percentage.
 */
const INDEPENDENCE_TOLERANCE = 1e-6;

/** @type {!WeakMap<!Matrix, !Array>} Stats keep their matrices, so a hover redraw reuses the split. */
const splits = new WeakMap();

/**
 * Splits a distribution over a display's wires into contiguous blocks of wires whose outcomes are
 * independent of each other's, so each block can be read on its own: the joint probability of an
 * outcome is the product of its blocks' probabilities. Bit k of an outcome's index is the display's
 * k-th wire from the top.
 *
 * Blocks follow the wires' order, so a block sits beside its own wires. Wires that are independent
 * but not adjacent stay in one block with the wires between them.
 *
 * @param {!Matrix} probabilities A column whose real parts are the probabilities, 2^wireCount long.
 * @param {!int} wireCount
 * @returns {!Array.<!{start: !int, length: !int, probabilities: !Matrix}>} Top to bottom. One block,
 *     holding the given matrix, when no wires come apart.
 */
export function independentBlocks(probabilities, wireCount) {
    const cached = splits.get(probabilities);
    if (cached !== undefined) {
        return cached;
    }
    const size = 1 << wireCount;
    const buffer = probabilities.rawBuffer();
    const p = new Float64Array(size);
    for (let i = 0; i < size; i++) {
        p[i] = buffer[i * 2];
    }

    // Independence at two cuts gives independence of the three blocks they make, so each cut is
    // tested on the whole distribution.
    const cuts = [0];
    for (let k = 1; k < wireCount; k++) {
        if (separatesAt(p, wireCount, k)) {
            cuts.push(k);
        }
    }
    cuts.push(wireCount);

    const blocks = cuts.length === 2 ? [{start: 0, length: wireCount, probabilities}] :
        cuts.slice(1).map((end, i) => {
            const start = cuts[i];
            const part = marginal(p, start, end - start);
            const column = new Float64Array(part.length * 2);
            part.forEach((value, j) => { column[j * 2] = value; });
            return {start, length: end - start, probabilities: new Matrix(1, part.length, column)};
        });
    splits.set(probabilities, blocks);
    return blocks;
}

/**
 * Splits a distribution into groups of wires, adjacent or not, whose outcomes are independent of
 * the other groups': the joint probability of an outcome is the product of its groups'. Wires are
 * first linked wherever a pair of them is correlated. Pairs miss a correlation that only three or
 * more wires share - q2 = q0 XOR q1 looks independent in every pair - so each linked group is then
 * checked against all the other wires, and the groups that fail that check merge into one.
 *
 * Works on outcome probabilities, so wires correlated only classically, after a measurement, stay
 * together as well as entangled ones.
 *
 * @param {!Matrix} probabilities A column whose real parts are the probabilities, 2^wireCount long.
 * @param {!int} wireCount
 * @returns {!Array.<!{wires: !Array.<!int>, probabilities: !Matrix}>} Ordered by lowest wire, each
 *     group's wires ascending; bit j of a group's outcome is its j-th wire.
 */
export function independentGroups(probabilities, wireCount) {
    const size = 1 << wireCount;
    const buffer = probabilities.rawBuffer();
    const p = new Float64Array(size);
    for (let i = 0; i < size; i++) {
        p[i] = buffer[i * 2];
    }

    const ones = new Float64Array(wireCount);
    for (let i = 0; i < size; i++) {
        for (let w = 0; w < wireCount; w++) {
            if ((i >> w) & 1) ones[w] += p[i];
        }
    }
    const parent = Array.from({length: wireCount}, (_, w) => w);
    const root = w => parent[w] === w ? w : (parent[w] = root(parent[w]));
    for (let a = 0; a < wireCount; a++) {
        for (let b = a + 1; b < wireCount; b++) {
            // Two binary outcomes are independent exactly when both-on matches the product.
            const mask = (1 << a) | (1 << b);
            let both = 0;
            for (let i = 0; i < size; i++) {
                if ((i & mask) === mask) both += p[i];
            }
            if (Math.abs(both - ones[a] * ones[b]) > INDEPENDENCE_TOLERANCE) {
                parent[root(b)] = root(a);
            }
        }
    }
    const linked = new Map();
    for (let w = 0; w < wireCount; w++) {
        linked.set(root(w), [...(linked.get(root(w)) ?? []), w]);
    }

    const settled = [];
    const unsettled = [];
    for (const wires of linked.values()) {
        (separatesWires(p, wireCount, wires) ? settled : unsettled).push(wires);
    }
    if (unsettled.length > 0) {
        settled.push(unsettled.flat().sort((a, b) => a - b));
    }
    return settled.sort((a, b) => a[0] - b[0]).map(wires => {
        const part = marginalOver(p, wires);
        const column = new Float64Array(part.length * 2);
        part.forEach((value, j) => { column[j * 2] = value; });
        return {wires, probabilities: new Matrix(1, part.length, column)};
    });
}

/**
 * @param {!Float64Array} probabilities One probability per outcome over every wire.
 * @param {!Array.<!int>} wires Ascending.
 * @returns {!Float64Array} The distribution over those wires alone, bit j of an outcome from the j-th.
 */
export function marginalProbabilities(probabilities, wires) {
    return marginalOver(probabilities, wires);
}

/**
 * @param {!int} i An outcome over every wire.
 * @param {!Array.<!int>} wires
 * @returns {!int} The outcome over just those wires, bit j from the j-th.
 */
function gather(i, wires) {
    let index = 0;
    for (let j = 0; j < wires.length; j++) {
        index |= ((i >> wires[j]) & 1) << j;
    }
    return index;
}

/**
 * @param {!Float64Array} p
 * @param {!Array.<!int>} wires
 * @returns {!Float64Array} The distribution over those wires alone.
 */
function marginalOver(p, wires) {
    const result = new Float64Array(1 << wires.length);
    for (let i = 0; i < p.length; i++) {
        result[gather(i, wires)] += p[i];
    }
    return result;
}

/**
 * @param {!Float64Array} p
 * @param {!int} wireCount
 * @param {!Array.<!int>} wires
 * @returns {!boolean} Whether those wires' outcomes are independent of all the other wires'.
 */
function separatesWires(p, wireCount, wires) {
    const rest = Array.from({length: wireCount}, (_, w) => w).filter(w => !wires.includes(w));
    if (rest.length === 0) {
        return true;
    }
    const own = marginalOver(p, wires);
    const others = marginalOver(p, rest);
    for (let i = 0; i < p.length; i++) {
        if (Math.abs(p[i] - own[gather(i, wires)] * others[gather(i, rest)]) > INDEPENDENCE_TOLERANCE) {
            return false;
        }
    }
    return true;
}

/**
 * @param {!Float64Array} p
 * @param {!int} start The first wire.
 * @param {!int} length How many wires.
 * @returns {!Float64Array} The distribution over those wires alone.
 */
function marginal(p, start, length) {
    const result = new Float64Array(1 << length);
    const mask = (1 << length) - 1;
    for (let i = 0; i < p.length; i++) {
        result[(i >> start) & mask] += p[i];
    }
    return result;
}

/**
 * @param {!Float64Array} p
 * @param {!int} wireCount
 * @param {!int} k
 * @returns {!boolean} Whether the wires above k and the wires from k down are independent.
 */
function separatesAt(p, wireCount, k) {
    const upper = marginal(p, 0, k);
    const lower = marginal(p, k, wireCount - k);
    const mask = (1 << k) - 1;
    for (let i = 0; i < p.length; i++) {
        if (Math.abs(p[i] - upper[i & mask] * lower[i >> k]) > INDEPENDENCE_TOLERANCE) {
            return false;
        }
    }
    return true;
}
