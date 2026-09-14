import {AngleField} from '../../math/angle-field.jsx';
import {MatrixMethod} from './matrix-method.jsx';
import {normalizedAxis, parseRotationDraft} from './construction.js';
import {parseAngleExpression} from '../../../engine/math/formula/AngleExpression.js';
import {useRef} from 'react';

export function RotationMethod({draft, onDraftChange, onCreate, onCancel}) {
    const unitDrafts = useRef({});
    const set = patch => {if ('angle' in patch || 'phase' in patch) unitDrafts.current={}; onDraftChange({...draft, ...patch});};
    let axis, phase, error;
    try {axis = normalizedAxis(draft.axis);} catch (e) {error = e.message;}
    try {phase = parseAngleExpression(draft.phase, draft.unit).radians;} catch { /* Field displays the error. */ }
    const parse = () => parseRotationDraft(draft);
    return <MatrixMethod kind="Rotation" draft={draft} onDraftChange={onDraftChange} parseOp={parse}
        onCreate={onCreate} onCancel={onCancel} extraPreview={<p className="field-description">Global phase: {phase === undefined ? 'incomplete' : `${Number(phase.toPrecision(6))} rad`}. Global phase does not appear on the Bloch sphere.</p>}>
        <fieldset className="axis-presets"><legend>Rotation axis</legend>
            {['X','Y','Z','Custom'].map(value => <button key={value} type="button" aria-pressed={draft.preset === value}
                onClick={() => set({preset:value, axis:value === 'Custom' ? draft.customAxis : value})}>{value}</button>)}
        </fieldset>
        {draft.preset === 'Custom' && <label className="forge-field" htmlFor="gate-forge-rotation-axis">Custom axis
            <input id="gate-forge-rotation-axis" value={draft.axis} aria-invalid={!!error}
                onChange={e => set({axis:e.target.value, customAxis:e.target.value})} />
        </label>}
        <p className={error ? 'field-error' : 'field-description'}>{error || `Normalized axis: (${axis.map(x => Number(x.toPrecision(4))).join(', ')})`}</p>
        <AngleField id="gate-forge-rotation-angle" value={draft.angle} unit={draft.unit} unitDisabled={phase === undefined} onChange={angle => set({angle})}
            onUnitChange={(unit, angle) => {
                unitDrafts.current[draft.unit]={angle:draft.angle,phase:draft.phase};
                onDraftChange({...draft,unit,...(unitDrafts.current[unit] ?? {angle,phase:String(parseAngleExpression(draft.phase,draft.unit)[unit])})});
            }} />
        <AngleField id="gate-forge-rotation-phase" label={`Global phase (${draft.unit})`} value={draft.phase} unit={draft.unit} showUnit={false}
            onChange={phase => set({phase})} />
    </MatrixMethod>;
}
