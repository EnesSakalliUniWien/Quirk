import {useEffect} from 'react';
import {useStore} from 'zustand';
import { fromJsonText_CircuitDefinition } from "../../../serialization/circuits/text.js";
import {appStore} from '../../../state/appStore.js';
import {CircuitFigure} from '../../gate/circuit-figure.jsx';
import {GatePreview} from '../../gate/gate-preview.jsx';
import {useDraftPreview} from './useDraftPreview.js';
import {validateCircuitRange,parseCircuitDraft} from './construction.js';
import {inputKey} from './inputs.js';

export function CircuitMethod({deps, circuitJson, draft, onDraftChange, onCreate, onCancel}) {
    const result = useDraftPreview(inputKey(draft,circuitJson), () => {
        const circuit = fromJsonText_CircuitDefinition(circuitJson);
        return parseCircuitDraft(circuit,draft);
    });
    const value = !result.pending ? result.value : undefined;
    useEffect(() => {
        appStore.setState({forgeRange:value ? {circuitJson, range:value.range} : undefined});
        return () => appStore.setState({forgeRange:undefined});
    }, [value,circuitJson]);
    const nested = value?.gate.knownCircuitNested;
    // While the circuit is debugged nothing moves on its own, this figure included.
    const debugging = useStore(appStore, state => state.debugging);
    return <form className="forge-method" onSubmit={event => {
        event.preventDefault();
        if (!value) return;
        validateCircuitRange(fromJsonText_CircuitDefinition(circuitJson), draft.cols, draft.rows);
        onCreate(value.gate, circuitJson);
    }}><div className="construction-scroll"><div className="construction-layout">
        <div className="forge-fields"><h2>From Circuit</h2>
            {['cols','rows'].map((field, index) => <label className="forge-field" key={field} htmlFor={`gate-forge-circuit-${field}`}>
                {index === 0 ? 'Column range' : 'Wire range'}
                <input id={`gate-forge-circuit-${field}`} value={draft[field]} onChange={e => onDraftChange({...draft,[field]:e.target.value})} />
            </label>)}
            <p className="field-description">1:3 includes 1 through 3. 1:∞ includes through the last. Every selected gate must fit completely.</p>
            <label className="forge-field" htmlFor="gate-forge-circuit-name">Circuit symbol
                <input id="gate-forge-circuit-name" value={draft.name} placeholder="Use the circuit preview" onChange={e => onDraftChange({...draft,name:e.target.value})} />
            </label>
            {value && <dl className="forge-stats">
                <dt>Columns</dt><dd>{value.range.colStart + 1}–{value.range.colEnd}</dd>
                <dt>Wires</dt><dd>{value.range.wireStart + 1}–{value.range.wireEnd}</dd>
                <dt>Gate qubits</dt><dd>{value.gate.height}{value.gate.height < value.range.wireEnd-value.range.wireStart ? ' (unused trailing wires omitted)' : ''}</dd>
                <dt>Gates</dt><dd>{nested.columns.reduce((n,c) => n+c.gates.filter(Boolean).length,0)}</dd>
                <dt>Required input ranges</dt><dd>{[...value.gate.getUnmetContextKeys()].join(', ') || 'None'}</dd>
                <dt title="Existing circuit gate-weight metric">Weight</dt><dd>{value.gate.knownCircuit.gateWeight()}</dd>
            </dl>}
        </div><div className="construction-preview" id="gate-forge-circuit-canvas" aria-busy={result.pending}>
            <h2>Selected circuit</h2>
            {result.pending ? <p role="status">Updating preview…</p> : result.error ? <p className="field-error" role="alert">{result.error}</p> : value && <>
                <CircuitFigure circuit={nested} time={deps.cycleTime()} responsive animate={!debugging && value.gate.stableDuration() !== Infinity} cycleTime={deps.cycleTime} />
                <GatePreview gate={value.gate} />
            </>}
        </div>
    </div></div><footer className="construction-actions"><button type="button" onClick={onCancel}>Cancel</button>
        <button id="gate-forge-circuit-button" type="submit" disabled={!value}>Create gate</button></footer>
    </form>;
}
