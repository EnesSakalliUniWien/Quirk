import {useState} from 'react';
import {pureStateOf} from '../../../gates/assertions/assertionVerdicts.js';

/** @param {!number} value @returns {!string} A number as the formula field reads it back. */
const numberText = value => String(Math.round(value * 1e6) / 1e6);

/**
 * @param {!Array.<!number>} amplitude [real, imaginary]
 * @returns {!string} The amplitude as a formula: "0.707107", "-i", "0.5+0.5i".
 */
function amplitudeText([real, imag]) {
    const [re, im] = [numberText(real), numberText(imag)];
    if (im === '0') return re;
    const imaginary = im === '1' ? 'i' : im === '-1' ? '-i' : `${im}i`;
    return re === '0' ? imaginary : `${re}${imag > 0 ? '+' : ''}${imaginary}`;
}

/**
 * The editor of a state given as amplitudes: a formula field for each basis state, instead of one
 * line of commas, and the state the wires are in at the gate, to start from. It hands the amplitudes
 * on as the text the gate's paramDialog applies.
 *
 * @param {!{target: !{col: !int, row: !int, gate: !Gate}, deps: !Object, inputRef: !Object,
 *     onChange: !function(!string): void}} props
 */
export function AmplitudesEditor({target, deps, inputRef, onChange}) {
    const span = target.gate.height;
    const [fields, setFields] = useState(() => target.gate.param.map(amplitudeText));
    const update = next => {
        setFields(next);
        onChange(next.join(', '));
    };
    // What the simulator found at the gate: a pure state of these wires, or none.
    const found = () => {
        const density = deps.completed.getState().value?.fullStats.customStatsForSlot(target.col, target.row)?.density;
        return density === undefined || density.hasNaN() ? undefined : pureStateOf(density);
    };
    const [unavailable, setUnavailable] = useState(false);

    return <>
        <p className="gate-param-message">{target.gate.paramDialog.message}</p>
        <div className="amplitudes-editor" role="group" aria-label="Amplitudes">
            {fields.map((field, k) => {
                const ket = `|${k.toString(2).padStart(span, '0')}⟩`;
                return <label className="amplitudes-editor-row" key={ket}>
                    <span className="amplitudes-editor-ket">{ket}</span>
                    <input ref={k === 0 ? inputRef : undefined} className="gate-param-input" aria-label={`Amplitude of ${ket}`}
                        value={field} onChange={e => update(fields.map((old, i) => i === k ? e.target.value : old))} />
                </label>;
            })}
        </div>
        <button id="amplitudes-use-state-button" type="button" onClick={() => {
            const state = found();
            setUnavailable(state === undefined);
            if (state !== undefined) update(state.map(amplitudeText));
        }}>Use the state at this gate</button>
        <p className="gate-param-message" role="status" hidden={!unavailable}>
            These wires have no pure state of their own here: they are entangled with others, or measured.
        </p>
    </>;
}
