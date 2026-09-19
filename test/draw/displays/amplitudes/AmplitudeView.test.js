import {Suite, assertThat} from '../../../TestUtil.js';
import {DisplayView} from '../../scene/TestDisplayView.js';
import {AMPLITUDE_RENDERER_FROM_CUSTOM_STATS} from '../../../../src/draw/displays/amplitudes/AmplitudeView.js';
import {displayData} from '../../../../src/components/panels/complex-display/displayData.js';
import {Gates} from '../../../../src/gates/AllGates.js';
import {CircuitDefinition} from '../../../../src/circuit/model/CircuitDefinition.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {Rect} from '../../../../src/geometry/Rect.js';
import {CanvasTheme} from '../../../../src/config/CanvasTheme.js';
import {labelsIn} from '../../../editor/rendering/RenderingTestUtil.js';

const suite = new Suite('AmplitudeView');

const statsFor = (gate, data) => ({customStatsForSlot: () => data, circuitDefinition: {
    columns: [{gates: [gate]}], registers: CircuitDefinition.EMPTY.registers, colIsMeasuredMask: () => 0}});

/** Draws an amplitude display with a coherent ket and returns its view. */
async function drawDisplay(span, ket, rect) {
    const gate = Gates.Displays.AmplitudeDisplayFamily.ofSize(span);
    const data = {quality: 1, ket, incoherentKet: ket, phaseLockIndex: undefined};
    const view = new DisplayView(document.createElement('canvas'));
    AMPLITUDE_RENDERER_FROM_CUSTOM_STATS({painter: view, gate, stats: statsFor(gate, data), customStats: data,
        positionInCircuit: {row: 0, col: 0}, rect, focusPoints: []});
    await view.commit();
    return view;
}

suite.test('amplitude cells fit inside their gate, and the frame follows the cells', async () => {
    // A two-wire display is taller than it is wide: 152 units of wires against 120 of columns.
    const rect = new Rect(10, 10, 120, 152);
    const view = await drawDisplay(2, Matrix.fromRows([[0.5, 0.5], [0.5, 0.5]]), rect);
    const [x, y, diam, cols, rows] = view.children.find(child => child.previous).previous.values;
    assertThat(x >= rect.x && y >= rect.y && x + diam*cols <= rect.right() && y + diam*rows <= rect.bottom()).isEqualTo(true);
    const frames = [];
    // Frames are rounded tiles: their stroke colour sits after the corner radius.
    const collect = node => {
        if (node.values?.[0] === 'roundRect' && node.values[7] === CanvasTheme.stroke.displayFrame) frames.push(node.values.slice(1, 5));
        for (const child of node.children ?? []) collect(child);
    };
    collect(view);
    assertThat(frames.length).isEqualTo(1);
    const cells = [x, y, diam*cols, diam*rows];
    assertThat(frames[0].every((value, i) => Math.abs(value - cells[i]) < 1e-9)).withInfo({frames, cells}).isEqualTo(true);
});

suite.test('cells too small to name their basis state get row and column labels at the grid edges', async () => {
    // Ten wires and ten columns give square cells of under 24 units.
    const view = await drawDisplay(10, Matrix.generate(32, 32, () => 1/32), new Rect(0, 0, 760, 1048));
    const texts = labelsIn(view).map(label => label.text);
    assertThat(texts.includes('00000⋯') && texts.includes('⋯00000')).withInfo({texts: texts.slice(0, 8)}).isEqualTo(true);
    assertThat(texts.some(text => /^[01]{10}$/.test(text))).isEqualTo(false);
});
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
