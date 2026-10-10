/**
 * A state's overall phase is not physical: |ψ⟩ and e^{iγ}|ψ⟩ are one state, and only the phases
 * between amplitudes can be measured. A picture of the amplitudes therefore measures every phase
 * from one of them. This is the rule both amplitude pictures - the circuit's state-vector grid and
 * its Amps gates - use, so the same state reads the same in each.
 */

/** Amplitudes whose chances agree to this fraction of the largest tie, and the first one wins. */
const TIE = 1e-6;

/**
 * @param {!Float32Array|!Float64Array|!Array.<!number>} buf Interleaved real and imaginary parts.
 * @returns {undefined|!int} The basis state phases are measured from: the largest amplitude, the
 *     first of any that tie, so a uniform state is read from |0…0⟩. Undefined when every amplitude
 *     is zero or the buffer holds NaN.
 */
function phaseReferenceIndex(buf) {
  let largest = 0;
  for (let k = 0; k < buf.length; k += 2) {
    largest = Math.max(largest, buf[k] * buf[k] + buf[k + 1] * buf[k + 1]);
  }
  if (!(largest > 0)) return undefined;
  for (let k = 0; k < buf.length; k += 2) {
    if (buf[k] * buf[k] + buf[k + 1] * buf[k + 1] >= largest * (1 - TIE))
      return k >> 1;
  }
  return undefined;
}

/**
 * @param {!Float32Array|!Float64Array} buf Interleaved real and imaginary parts.
 * @param {undefined|!int} index The basis state to measure phases from.
 * @returns {!Float32Array} The same amplitudes turned together so the reference's phase is zero;
 *     their sizes and the phases between them are unchanged.
 */
function withPhaseReference(buf, index) {
  const out = new Float32Array(buf.length);
  const angle =
    index === undefined ? 0 : Math.atan2(buf[index * 2 + 1], buf[index * 2]);
  const c = Math.cos(angle),
    s = Math.sin(angle);
  for (let k = 0; k < buf.length; k += 2) {
    // Multiplying by e^{-iγ}.
    out[k] = buf[k] * c + buf[k + 1] * s;
    out[k + 1] = buf[k + 1] * c - buf[k] * s;
  }
  return out;
}

export { phaseReferenceIndex, withPhaseReference };
