import {useMemo, useState} from 'react';
import {OperatorMatrix} from '../../math/operator-matrix.jsx';
import {parseMatrixDraft} from './construction.js';
import {MathField} from '../../math/math-field.jsx';

const identityCells = size => Array.from({length:size * size}, (_, i) => i % (size + 1) === 0 ? '1' : '0');
const matrixText = (cells, size) => `{${Array.from({length:size}, (_, row) => `{${cells.slice(row * size, (row + 1) * size).join(',')}}`).join(',')}}`;

export function MatrixInput({draft, onChange}) {
    const [error, setError] = useState('');
    const [activeCell,setActiveCell] = useState(0);
    const set = patch => {setError(''); onChange({...draft, ...patch});};
    const selectMode = mode => {
        if (mode === draft.mode) return;
        if (mode === 'raw') {set({mode, text:draft.rawBeforeGrid ?? draft.text}); return;}
        try {
            const matrix = parseMatrixDraft(draft.text);
            const size = matrix.width();
            const cells = Array.from({length:size * size}, (_, i) => matrix.cell(i % size, Math.floor(i / size)).toString());
            set({mode, size, rawBeforeGrid:draft.text, grids:{...draft.grids, [size]:cells}});
        } catch (e) {setError(e.message);}
    };
    const chooseSize = size => {
        const cells = draft.grids[size] ?? identityCells(size);
        set({size, mode:'grid', text:matrixText(cells,size), grids:{...draft.grids,[size]:cells}, rawBeforeGrid:undefined, correction:'none'});
    };
    const cells = draft.grids[draft.size];
    return <>
        <div className="field-label-row"><span>Matrix entry</span><div className="entry-modes" role="group" aria-label="Matrix entry mode">
            <button type="button" aria-pressed={draft.mode === 'grid'} onClick={() => selectMode('grid')}>Grid</button>
            <button type="button" aria-pressed={draft.mode === 'raw'} onClick={() => selectMode('raw')}>Raw text</button>
        </div></div>
        {draft.mode === 'raw' ? <label className="forge-field" htmlFor="gate-forge-matrix">Matrix values
            <textarea id="gate-forge-matrix" value={draft.text} spellCheck={false}
                onChange={e => set({text:e.target.value, correction:'none', rawBeforeGrid:undefined})} />
        </label> : <>
            <div className="field-label-row"><label>Dimension <select aria-label="Matrix dimension" value={draft.size} onChange={e => chooseSize(Number(e.target.value))}>
                {[2,4,8,16].map(n => <option key={n} value={n}>{n}×{n} · {Math.log2(n)} qubit{n === 2 ? '' : 's'}</option>)}
            </select></label><button type="button" onClick={() => {
                const cells = identityCells(draft.size);
                set({text:matrixText(cells,draft.size), grids:{...draft.grids,[draft.size]:cells}, correction:'none', rawBeforeGrid:undefined});
            }}>Reset to identity</button></div>
            <div className="matrix-input-scroll"><table className="matrix-input-grid"><thead><tr><th aria-label="Row / column" />
                {Array.from({length:draft.size}, (_, col) => <th key={col} scope="col">{col + 1}</th>)}
            </tr></thead><tbody>{Array.from({length:draft.size}, (_, row) => <tr key={row}><th scope="row">{row + 1}</th>
                {Array.from({length:draft.size}, (_, col) => <td key={col}><input aria-label={`Row ${row + 1}, column ${col + 1}`}
                    value={cells[row * draft.size + col]} spellCheck={false} onFocus={() => setActiveCell(row * draft.size + col)} onChange={event => {
                        const next = [...cells]; next[row * draft.size + col] = event.target.value;
                        set({grids:{...draft.grids,[draft.size]:next}, text:matrixText(next,draft.size), correction:'none', rawBeforeGrid:undefined});
                    }} /></td>)}
            </tr>)}</tbody></table></div>
            <label className="forge-field" htmlFor="matrix-cell-editor">Selected entry · row {Math.floor(Math.min(activeCell,cells.length-1)/draft.size)+1}, column {Math.min(activeCell,cells.length-1)%draft.size+1}</label>
            <MathField key={Math.min(activeCell,cells.length-1)} id="matrix-cell-editor" label="Selected matrix entry" allowComplex
                value={cells[Math.min(activeCell,cells.length-1)]} onChange={text => {
                    const next = [...cells]; next[Math.min(activeCell,cells.length-1)] = text;
                    set({grids:{...draft.grids,[draft.size]:next},text:matrixText(next,draft.size),correction:'none',rawBeforeGrid:undefined});
                }} />
        </>}
        {error && <p className="field-error" role="alert">{error}</p>}
        <p className="field-description">Complex entries accept i, pi and formulas. Trigonometric functions in matrix entries use degrees. Raw lists may be padded with zeroes; the preview shows the complete operator.</p>
    </>;
}

export function MatrixCorrection({draft, onChange}) {
    const comparison = useMemo(() => {
        try {
            const entered = parseMatrixDraft(draft.text);
            if (draft.correction === 'none') return {entered};
            const corrected = parseMatrixDraft(draft.text,true);
            return {entered, corrected, difference:Math.sqrt(entered.minus(corrected).norm2())};
        } catch (error) {return {error:error.message};}
    }, [draft.text, draft.correction]);
    if (comparison.error) return <p className="field-error">{comparison.error}</p>;
    if (!comparison.corrected) return <button type="button" onClick={() => onChange({...draft, correction:'offered'})}>Make unitary</button>;
    return <section className="matrix-correction" aria-label="Matrix correction comparison">
        <h3>Compare before accepting</h3>
        <OperatorMatrix matrix={comparison.entered} label="Entered matrix" />
        <OperatorMatrix matrix={comparison.corrected} label="Corrected matrix" />
        <p>Difference norm: {Number(comparison.difference.toPrecision(6))}</p>
        <div className="entry-modes"><button type="button" aria-pressed={draft.correction === 'accepted'}
            onClick={() => onChange({...draft, correction:'accepted'})}>Use corrected matrix</button>
            <button type="button" onClick={() => onChange({...draft, correction:'none'})}>Keep entered matrix</button></div>
        <p role="status">{draft.correction === 'accepted' ? 'The corrected matrix will be created.' : 'The entered matrix will be created until you accept the correction.'}</p>
    </section>;
}
