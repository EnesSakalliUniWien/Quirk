/**
 * What each assertion asks of the local state of its wires, as a density matrix over them with
 * wire k the k'th bit of a basis index. Pure functions: no gate, no simulator.
 */

/** How far a number may be from what it should be before it counts. */
const TOLERANCE = 1e-4;

/**
 * @param {!Matrix} density
 * @returns {!boolean} Whether more than one basis state has a chance: the wires are in a
 *     superposition, or a mixture, of basis states rather than in one of them.
 */
function isSuperposition(density) {
    let outcomes = 0;
    for (let k = 0; k < density.width(); k++) {
        if (density.cell(k, k).real > TOLERANCE) outcomes++;
    }
    return outcomes > 1;
}

/**
 * The density matrix of some of the wires, the others traced out.
 *
 * @param {!Matrix} density Over `wireCount` wires.
 * @param {!int} wireCount
 * @param {!Array.<!int>} kept The wires to keep; kept[k] becomes bit k.
 * @returns {!Array.<!Array.<!{real: !number, imag: !number}>>} Indexed [row][col].
 */
function marginal(density, wireCount, kept) {
    const size = 1 << kept.length;
    const others = Array.from({length: wireCount}, (_, wire) => wire).filter(wire => !kept.includes(wire));
    const index = (keptBits, otherBits) =>
        kept.reduce((sum, wire, k) => sum | (((keptBits >> k) & 1) << wire), 0) |
        others.reduce((sum, wire, k) => sum | (((otherBits >> k) & 1) << wire), 0);
    return Array.from({length: size}, (_, row) => Array.from({length: size}, (_, col) => {
        let real = 0;
        let imag = 0;
        for (let rest = 0; rest < 1 << others.length; rest++) {
            const cell = density.cell(index(col, rest), index(row, rest));
            real += cell.real;
            imag += cell.imag;
        }
        return {real, imag};
    }));
}

/**
 * @param {!Matrix} density Over `wireCount` wires.
 * @param {!int} wireCount
 * @returns {!boolean} Whether every two of the wires are correlated: their joint state is not the
 *     product of their own states. For a pure state that is entanglement. After a measurement the
 *     simulator defers, it is also true of wires that merely agree classically.
 */
function isEntangled(density, wireCount) {
    for (let a = 0; a < wireCount; a++) {
        for (let b = a + 1; b < wireCount; b++) {
            const joint = marginal(density, wireCount, [a, b]);
            const [first, second] = [marginal(density, wireCount, [a]), marginal(density, wireCount, [b])];
            let distance = 0;
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    const p = first[row & 1][col & 1];
                    const q = second[row >> 1][col >> 1];
                    distance = Math.max(distance,
                        Math.abs(joint[row][col].real - (p.real * q.real - p.imag * q.imag)),
                        Math.abs(joint[row][col].imag - (p.real * q.imag + p.imag * q.real)));
                }
            }
            if (distance <= TOLERANCE) return false;
        }
    }
    return true;
}

/**
 * @param {!Matrix} density Over the wires.
 * @param {!Array.<!Array.<!number>>} amplitudes The claimed state's, [real, imaginary] for each basis
 *     state, of unit length.
 * @returns {!boolean} Whether the wires are in the claimed state, whatever its global phase: the
 *     fidelity ⟨ψ|ρ|ψ⟩ is 1.
 */
function isState(density, amplitudes) {
    let fidelity = 0;
    for (let row = 0; row < amplitudes.length; row++) {
        for (let col = 0; col < amplitudes.length; col++) {
            const cell = density.cell(col, row);
            const [ar, ai] = amplitudes[row];
            const [br, bi] = amplitudes[col];
            // The real part of conj(a) · cell · b; the imaginary parts cancel over the sum.
            fidelity += (ar * br + ai * bi) * cell.real - (ar * bi - ai * br) * cell.imag;
        }
    }
    return fidelity >= 1 - TOLERANCE;
}

/**
 * @param {!Matrix} density Over the wires.
 * @returns {undefined|!Array.<!Array.<!number>>} The amplitudes of the pure state the wires are in,
 *     its largest one real and positive, or undefined while they are in no pure state of their own:
 *     entangled with other wires, or measured.
 */
function pureStateOf(density) {
    const size = density.width();
    let purity = 0;
    let largest = 0;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) purity += density.cell(row, col).norm2();
        if (density.cell(row, row).real > density.cell(largest, largest).real) largest = row;
    }
    if (!(purity >= 1 - TOLERANCE)) return undefined;
    // A pure ρ is |ψ⟩⟨ψ|, so its column at ψ's largest amplitude is ψ, scaled by that amplitude.
    const scale = Math.sqrt(density.cell(largest, largest).real);
    return Array.from({length: size}, (_, row) => {
        const cell = density.cell(largest, row);
        return [cell.real / scale, cell.imag / scale];
    });
}

export {isSuperposition, isEntangled, isState, pureStateOf};
