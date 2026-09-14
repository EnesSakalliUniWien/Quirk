import {useRef} from 'react';
import {Field} from '@base-ui/react/field';
import {parseAngleExpression} from '../../engine/math/formula/AngleExpression.js';
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
                <option value="radians">Radians</option><option value="degrees">Degrees</option>
            </select>}
        </div>
        <MathField id={id} inputRef={inputRef} label={label} value={value} onChange={change} onKeyboardShow={onKeyboardShow}
            invalid={!!error} describedBy={`${id}-description`} />
        <p id={`${id}-description`} className={error ? 'field-error' : 'field-description'} aria-live="polite">
            {error || `${Number(parsed.radians.toPrecision(7))} rad = ${Number(parsed.degrees.toPrecision(7))}°`}
        </p>
    </Field.Root>;
}
