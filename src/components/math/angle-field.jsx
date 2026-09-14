import {useRef} from 'react';
import {Field} from '@base-ui/react/field';
import {AngleUnit, parseAngleExpression} from '../../engine/math/formula/AngleExpression.js';
import {MathField} from './math-field.jsx';

/** Unit conversion preserves the value, and a round trip without editing preserves the text. */
export function AngleField({id, label = 'Angle', value, unit, onChange, onUnitChange, inputRef, unitDisabled = false,onKeyboardShow,showUnit = true}) {
    const cache = useRef({});
    let parsed, error;
    try { parsed = parseAngleExpression(value, unit); } catch (e) { error = e.message; }
    const change = text => {cache.current = {}; onChange(text);};
    const changeUnit = next => {
        if (!parsed || next === unit) return;
        cache.current[unit] = value;
        const text = cache.current[next] ?? String(parsed[next]);
        onUnitChange(next, text);
    };
    return <Field.Root className="angle-field" invalid={!!error}>
        <div className="field-label-row"><Field.Label htmlFor={id}>{label}</Field.Label>
            {showUnit && <select aria-label={`${label} unit`} value={unit} disabled={!parsed || unitDisabled} onChange={e => changeUnit(e.target.value)}>
                <option value={AngleUnit.RADIANS}>Radians</option><option value={AngleUnit.DEGREES}>Degrees</option>
            </select>}
        </div>
        <MathField id={id} inputRef={inputRef} label={label} value={value} onChange={change} onKeyboardShow={onKeyboardShow}
            invalid={!!error} describedBy={`${id}-description`} />
        {/* The live region outlasts the swap between readout and error, so a new error is announced. */}
        <div aria-live="polite">
            {error ? <Field.Error id={`${id}-description`} className="field-error" match>{error}</Field.Error> :
                <Field.Description id={`${id}-description`} className="field-description">
                    {`${Number(parsed.radians.toPrecision(7))} rad = ${Number(parsed.degrees.toPrecision(7))}°`}
                </Field.Description>}
        </div>
    </Field.Root>;
}
