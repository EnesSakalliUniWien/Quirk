import {paintCircuit} from '../../../../src/editor/rendering/CircuitRendering.js';
import {Suite, assertThat} from '../../../TestUtil.js';
import {DisplayView, scenePixels} from '../../../draw/scene/TestDisplayView.js';
import {CircuitViewState} from '../../../../src/editor/state/CircuitViewState.js';
import {CircuitDefinition} from '../../../../src/circuit/model/CircuitDefinition.js';
import {CircuitStats} from '../../../../src/engine/simulation/CircuitStats.js';
import {Gates} from '../../../../src/gates/AllGates.js';
import {PointerInteractionState} from '../../../../src/editor/interaction/PointerInteractionState.js';
import {drawCircuitTooltip} from '../../../../src/editor/rendering/previews/CircuitPreview.js';
import {Rect} from '../../../../src/geometry/Rect.js';
import {labelsIn} from '../RenderingTestUtil.js';

const suite = new Suite('CircuitRendering');

suite.test('tooltip circuits toggle wires without output labels or rebuilding the gate', async () => {
    const definition = CircuitDefinition.fromTextDiagram(new Map([['H',Gates.HalfTurns.H],['-',undefined]]), 'H-\n--');
    const circuit = CircuitViewState.empty(0).withCircuit(definition);
    const view = new DisplayView(document.createElement('canvas'));
    const stats = CircuitStats.fromCircuitAtTime(definition, 0);
    const x = Math.ceil(circuit.gateRect(0,0).right() + 5);
    const y = Math.floor(circuit.wireRect(0).center().y);
    paintCircuit(circuit, view, PointerInteractionState.EMPTY, stats, true, true);
    const visible = (await scenePixels(view.canvas,x,y,1,1)).data[3];
    const labels = labelsIn(view);
    assertThat(labels.map(label => label.text)).isEqualTo(['H']);
    view.begin();
    paintCircuit(circuit, view, PointerInteractionState.EMPTY, stats, true, false);
    const hidden = (await scenePixels(view.canvas,x,y,1,1)).data[3];
    assertThat(visible > 0).isEqualTo(true);
    assertThat(hidden).isEqualTo(0);
    assertThat(labelsIn(view)[0] === labels[0]).isEqualTo(true);
});

suite.test('definition previews match public tooltip rendering without creating display state', async () => {
    const definition = CircuitDefinition.fromTextDiagram(new Map([['H', Gates.HalfTurns.H]]), 'H');
    const circuit = CircuitViewState.empty(0).withCircuit(definition);
    const geometry = circuit.geometry();
    const stats = CircuitStats.withNanDataFromCircuitAtTime(definition, 0);
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    const view = new DisplayView(canvas);
    paintCircuit(circuit, view, PointerInteractionState.EMPTY, stats, true, true);
    const expected = (await scenePixels(canvas)).data;
    view.begin();
    drawCircuitTooltip(view, definition, new Rect(0, 0, geometry.desiredWidth(true), geometry.desiredHeight(true)), true, 0);
    const actual = (await scenePixels(canvas)).data;
    assertThat(actual).isEqualTo(expected);
    assertThat(circuit.geometry() === geometry).isEqualTo(true);
});
