import {useEffect, useRef, useState} from 'react';
import {useStore} from 'zustand';
import {GateColumn} from '../../../circuit/model/GateColumn.js';
import {appStore} from '../../../state/appStore.js';
import {closePanel} from '../../dock.jsx';
import {AngleField} from '../../math/angle-field.jsx';
import {AngleUnit, parseAngleExpression} from '../../../engine/math/formula/AngleExpression.js';

export function GateParamPanel() {
    const deps = useStore(appStore,s => s.panelDeps);
    const target = useStore(appStore,s => s.gateParamTarget);
    if (!deps) return null;
    return target ? <ParameterEditor key={`${target.col}:${target.row}:${target.gate.serializedId}:${target.gate.param}`} deps={deps} target={target} /> : <ParameterList deps={deps} />;
}
function ParameterList({deps}) {
    const shown = useStore(deps.displayed,s => s.value);
    const entries = [];
    shown.displayedCircuit.circuitDefinition.columns.forEach((column,col) => column.gates.forEach((gate,row) => {
        if (gate?.paramDialog) entries.push({gate,col,row});
    }));
    return <div className="panel-body gate-param-panel"><header><h2 className="gate-param-title">Gate Parameter</h2><p className="field-description">Choose a gate to edit.</p></header>
        <div className="construction-scroll parameter-targets">{entries.length ? entries.map(target => <button type="button" key={`${target.col}:${target.row}`}
            onClick={() => appStore.setState({gateParamTarget:target})}>{target.gate.symbol}({String(target.gate.param ?? '')}) · wire {target.row+1}, column {target.col+1}</button>) : <p>No parameter gates in this circuit.</p>}</div>
    </div>;
}
function ParameterEditor({deps,target}) {
    const [text,setText] = useState(String(target.gate.param ?? ''));
    const [unit,setUnit] = useState(AngleUnit.RADIANS);
    const [error,setError] = useState('');
    const [edited,setEdited] = useState(false);
    const inputRef = useRef(null);
    const openingControl = useRef(document.activeElement);
    const closing = useRef(false);
    const isAngle = target.gate.paramDialog.angleUnit === AngleUnit.RADIANS;
    let parsed,validation;
    if (isAngle) {
        try {parsed = parseAngleExpression(text,unit);} catch (e) {validation = e.message;}
    }
    useEffect(() => {
        inputRef.current?.focus({preventScroll:true}); inputRef.current?.select();
        const scroll = inputRef.current?.closest('.construction-scroll');
        if (scroll) scroll.scrollTop=0;
        return () => {
            const origin = openingControl.current;
            requestAnimationFrame(() => {
                if (document.querySelector('[data-panel-id="gate-param"] input')) return;
                if (origin?.isConnected && origin !== document.body) origin.focus();
                else document.getElementById('gate-parameter-button')?.focus();
            });
        };
    }, []);
    const close = () => {
        closing.current = true;
        appStore.setState({gateParamTarget:undefined});
        closePanel('gate-param');
    };
    const apply = () => {
        if (closing.current || validation) return;
        const definition = deps.displayed.getState().value.displayedCircuit.circuitDefinition;
        const oldGate = definition.gateInSlot(target.col,target.row);
        if (oldGate !== target.gate || !oldGate.paramDialog) {close(); return;}
        const value = !edited ? String(oldGate.param ?? '') : isAngle && unit === AngleUnit.DEGREES ? String(parsed.radians) : text;
        const result = oldGate.paramDialog.applyText(oldGate,value);
        if (result.error) {setError(result.error); return;}
        if (result.gate !== oldGate && result.gate.param !== oldGate.param) {
            const cols = [...definition.columns];
            const gates = [...cols[target.col].gates];
            gates[target.row] = result.gate;
            cols[target.col] = new GateColumn(gates);
            deps.revision.commit(deps.displayed.getState().value.withCircuitDefinition(definition.withColumns(cols)).afterTidyingUp().snapshot());
        }
        close();
    };
    return <form className="panel-body gate-param-panel" aria-labelledby="gate-param-title" onSubmit={e => {e.preventDefault(); apply();}}
        onKeyDown={e => {
            if (e.nativeEvent.isComposing) {if (e.key === 'Enter') e.preventDefault(); return;}
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            e.preventDefault();
            // Escape closes the open formula help before it cancels the window.
            const help = e.currentTarget.querySelector('.formula-help[open]');
            if (help) help.open = false; else close();
        }}>
        <header><h2 id="gate-param-title" className="gate-param-title">{target.gate.paramDialog.title}</h2>
            <p className="field-description">Wire {target.row+1} · Column {target.col+1}</p></header>
        <div className="construction-scroll">
            {isAngle ? <AngleField id="gate-param-input" value={text} unit={unit} inputRef={inputRef}
                onKeyboardShow={() => {
                    const group = appStore.getState().dock?.getPanel('gate-param')?.group;
                    const box = group?.api.boundingBox;
                    if (group?.api.location.type === 'floating' && box) {
                        const available = appStore.getState().dock.height-box.top-16;
                        group.api.setSize({height:Math.max(group.api.height,Math.min(560,available))});
                    }
                }}
                onChange={text => {setText(text); setEdited(true); setError('');}} onUnitChange={(unit,text) => {setUnit(unit); setText(text);}} /> : <>
                <p className="gate-param-message">{target.gate.paramDialog.message}</p>
                <input id="gate-param-input" ref={inputRef} className="gate-param-input" aria-label="Parameter value" value={text}
                    onChange={e => {setText(e.target.value); setEdited(true); setError('');}} />
            </>}
            <p id="gate-param-error" className="field-error" role="alert" hidden={!error}>{error}</p>
            {isAngle && <details className="formula-help"><summary>Formula help</summary><p className="gate-param-message">{target.gate.paramDialog.message}</p></details>}
        </div>
        <footer className="construction-actions"><button id="gate-param-cancel-button" type="button" onClick={close}>Cancel</button>
            <button id="gate-param-apply-button" type="submit" disabled={!!validation}>Apply</button></footer>
    </form>;
}
