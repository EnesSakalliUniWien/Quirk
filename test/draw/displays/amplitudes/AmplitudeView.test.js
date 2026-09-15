import {Suite, assertThat} from '../../../TestUtil.js';
import {DisplayView} from '../../scene/TestDisplayView.js';
import {AMPLITUDE_RENDERER_FROM_CUSTOM_STATS} from '../../../../src/draw/displays/amplitudes/AmplitudeView.js';
import {displayData} from '../../../../src/components/panels/complex-display/displayData.js';
import {Gates} from '../../../../src/gates/AllGates.js';
import {CircuitDefinition} from '../../../../src/circuit/model/CircuitDefinition.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {Rect} from '../../../../src/geometry/Rect.js';

const suite = new Suite('AmplitudeView');
suite.test('caption, phase hands and inspector agree near the coherence threshold', async () => {
    const gate = Gates.Displays.AmplitudeDisplayFamily.ofSize(1);
    for (const quality of [0.98, 0.995, 1]) {
        const data = {quality, ket:Matrix.fromRows([[1,0]]), incoherentKet:Matrix.fromRows([[0,1]]), phaseLockIndex:0};
        const stats = {customStatsForSlot:()=>data, circuitDefinition:{
            columns:[{gates:[gate]}], registers:CircuitDefinition.EMPTY.registers, colIsMeasuredMask:()=>0}};
        const inspector = displayData(stats,{col:0,row:0,gate});
        const view = new DisplayView(document.createElement('canvas'));
        AMPLITUDE_RENDERER_FROM_CUSTOM_STATS({painter:view,gate,stats,customStats:data,
            positionInCircuit:{row:0,col:0},rect:new Rect(0,0,120,40),focusPoints:[]});
        await view.commit();
        const graphic = view.children.find(child=>child.previous);
        assertThat(graphic.previous.buf).isEqualTo(inspector.matrix.rawBuffer());
        assertThat(graphic.previous.colors.some(color=>color!==undefined)).isEqualTo(inspector.coherent);
        const texts=[];
        const collect=node=>{if(typeof node.text==='string')texts.push(node.text);for(const child of node.children??[])collect(child);};
        collect(view);
        assertThat(texts.join(' ').includes('phase undefined')).isEqualTo(!inspector.coherent);
    }
});
