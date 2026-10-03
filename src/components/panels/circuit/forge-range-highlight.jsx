import {useStore} from 'zustand';
import {appStore} from '../../../state/appStore.js';
import { Serializer } from "../../../serialization/Serializer.js";
import { fromJsonText_CircuitDefinition } from "../../../serialization/circuits/text.js";
import {useMemo,useEffect,useReducer} from 'react';

export function ForgeRangeHighlight({host}) {
    const deps = useStore(appStore,s => s.panelDeps);
    const selection = useStore(appStore,s => s.forgeRange);
    const zoom = useStore(appStore,s => s.zoom);
    return deps && selection ? <Range deps={deps} selection={selection} zoom={zoom} host={host} /> : null;
}
function Range({deps,selection,zoom,host}) {
    const [,resized] = useReducer(n=>n+1,0);
    useEffect(()=>{
        const observer=new ResizeObserver(resized);
        observer.observe(host.current);
        return ()=>observer.disconnect();
    },[host]);
    // The circuit and whether the hand is busy, not the whole state: its hand moves with every mouse
    // move over the canvas, and the circuit it holds does not.
    const shown = useStore(deps.displayed,s => s.value.displayedCircuit);
    const busy = useStore(deps.displayed,s => s.value.hand.isBusy());
    const expected = useMemo(() => JSON.stringify(Serializer.toJson(fromJsonText_CircuitDefinition(selection.circuitJson))),[selection.circuitJson]);
    // Serialising the circuit to compare it is the cost, so it is paid once per circuit.
    const shownIsSelected = useMemo(() => JSON.stringify(Serializer.toJson(shown.circuitDefinition)) === expected,[shown.circuitDefinition,expected]);
    if (!shownIsSelected || busy) return null;
    const circuit = deps.syncArea(deps.displayed.getState().value).displayedCircuit;
    const {colStart,colEnd,wireStart,wireEnd} = selection.range;
    const rect = circuit.gateRect(wireStart,colStart,colEnd-colStart,wireEnd-wireStart);
    return <div className="forge-range-highlight" aria-hidden="true" style={{left:rect.x*zoom,top:rect.y*zoom,width:rect.w*zoom,height:rect.h*zoom}} />;
}
