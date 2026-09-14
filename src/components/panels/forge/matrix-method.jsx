import {OperationPreview} from './operation-preview.jsx';
import {GatePreview} from '../../gate/gate-preview.jsx';
import {useDraftPreview} from './useDraftPreview.js';
import {inputKey} from './inputs.js';
import {buildMatrixGate} from './construction.js';

/** Rotation and matrix methods share one operation preview and one commit path. */
export function MatrixMethod({kind, draft, onDraftChange, parseOp, onCreate, onCancel, children, extraPreview}) {
    const key = inputKey(kind, draft);
    const parse = () => {
        const matrix = parseOp();
        return {matrix, gate: buildMatrixGate(matrix, draft.name, kind)};
    };
    const result = useDraftPreview(key, parse);
    const prefix = `gate-forge-${kind.toLowerCase()}`;
    return <form className="forge-method" onSubmit={event => {
        event.preventDefault();
        if (!result.pending && result.value) {
            // Revalidate at the action boundary, even if a debounce is pending in React.
            parseOp();
            onCreate(result.value.gate);
        }
    }}>
        <div className="construction-scroll">
            <div className="construction-layout">
                <div className="forge-fields">
                    <h2>From {kind}</h2>
                    {children}
                    <label className="forge-field" htmlFor={`${prefix}-name`}>Circuit symbol
                        <input id={`${prefix}-name`} value={draft.name} placeholder="Use the operation preview"
                            onChange={event => onDraftChange({...draft, name:event.target.value})} />
                    </label>
                </div>
                <div className="construction-preview" id={`${prefix}-canvas`} aria-busy={result.pending}>
                    <h2>Preview</h2>
                    {result.pending ? <p role="status">Updating preview…</p> : result.error ?
                        <p className="field-error" role="alert">{result.error}</p> : result.value && <>
                            <OperationPreview matrix={result.value.matrix} />
                            {extraPreview}
                            <GatePreview gate={result.value.gate} />
                        </>}
                </div>
            </div>
        </div>
        <footer className="construction-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button id={`${prefix}-button`} type="submit" disabled={result.pending || !result.value}>Create gate</button>
        </footer>
    </form>;
}
