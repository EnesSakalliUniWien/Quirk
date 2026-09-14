import {useEffect, useMemo, useRef, useState} from 'react';
import {Tabs} from '@base-ui/react/tabs';
import {Serializer, fromJsonText_CircuitDefinition} from '../../../serialization/Serializer.js';
import {randomCustomGateId} from '../../../serialization/customGateParsing.js';
import {appStore} from '../../../state/appStore.js';
import {closePanel, openPanel} from '../../dock.jsx';
import {useObservedValue} from '../../useObservedValue.js';
import {RotationMethod} from './rotation-method.jsx';
import {MatrixMethod} from './matrix-method.jsx';
import {MatrixInput, MatrixCorrection} from './matrix-input.jsx';
import {CircuitMethod} from './circuit-method.jsx';
import {parseMatrixDraft} from './construction.js';

export function ForgePanelBody({deps}) {
    const commits = useMemo(() => deps.revision.latestActiveCommit(), [deps]);
    const circuitJson = useObservedValue(commits) ?? '';
    const [method, setMethod] = useState('rotation');
    const [rotation, setRotation] = useState({axis:'X+Z', customAxis:'X+Z', preset:'Custom', angle:'45', phase:'0', unit:'degrees', name:''});
    const [matrix, setMatrix] = useState({text:'{{1,0},{0,1}}', name:'', mode:'grid', size:2, grids:{2:['1','0','0','1']}, correction:'none'});
    const [circuit, setCircuit] = useState({cols:'1:∞', rows:'1:∞', name:''});
    const committed = useRef(false);
    const root = useRef(null);
    useEffect(() => {root.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus();}, []);
    useEffect(() => () => {appStore.setState({forgeRange:undefined});}, []);
    const close = () => {
        closePanel('forge');
        requestAnimationFrame(() => document.getElementById('gate-forge-button')?.focus());
    };
    const create = (gate, sourceJson = circuitJson) => {
        if (committed.current || sourceJson !== circuitJson) return;
        const definition = fromJsonText_CircuitDefinition(circuitJson);
        const finalGate = gate._copy();
        do {finalGate.serializedId = randomCustomGateId();}
        while (definition.customGateSet.gates.some(g => g.serializedId === finalGate.serializedId));
        committed.current = true;
        deps.revision.commit(JSON.stringify(Serializer.toJson(definition.withCustomGate(finalGate))));
        appStore.setState({customGateFocus:finalGate.serializedId});
        closePanel('forge');
        openPanel('gates');
    };
    return <div className="panel-body forge-panel" ref={root} aria-labelledby="forge-title" onKeyDown={event => {
        if (event.nativeEvent.isComposing) {if (event.key === 'Enter') event.preventDefault(); return;}
        if (event.key === 'Escape' && !event.defaultPrevented) {event.preventDefault(); close();}
    }}>
        <header className="panel-header"><h1 className="panel-title" id="forge-title">Make a gate</h1>
            <p className="panel-description">Define the operation, inspect it, then add it to Custom Gates.</p></header>
        <Tabs.Root className="forge-tabs" value={method} onValueChange={setMethod}>
            <Tabs.List className="construction-tabs" aria-label="Construction method">
                <Tabs.Tab value="rotation">Rotation</Tabs.Tab><Tabs.Tab value="matrix">Matrix</Tabs.Tab><Tabs.Tab value="circuit">Circuit</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="rotation" className="construction-tab-panel">
                <RotationMethod draft={rotation} onDraftChange={setRotation} onCreate={create} onCancel={close} />
            </Tabs.Panel>
            <Tabs.Panel value="matrix" className="construction-tab-panel">
                <MatrixMethod kind="Matrix" draft={matrix} onDraftChange={setMatrix}
                    parseOp={() => {
                        if (matrix.mode === 'grid' && matrix.grids[matrix.size].some(text => !text.trim())) throw new Error('Complete every matrix entry.');
                        return parseMatrixDraft(matrix.text, matrix.correction === 'accepted');
                    }} onCreate={create} onCancel={close}
                    extraPreview={<MatrixCorrection draft={matrix} onChange={setMatrix} />}>
                    <MatrixInput draft={matrix} onChange={setMatrix} />
                </MatrixMethod>
            </Tabs.Panel>
            <Tabs.Panel value="circuit" className="construction-tab-panel">
                <CircuitMethod deps={deps} circuitJson={circuitJson} draft={circuit} onDraftChange={setCircuit} onCreate={create} onCancel={close} />
            </Tabs.Panel>
        </Tabs.Root>
    </div>;
}
