import {paintCircuit} from '../../../src/editor/rendering/CircuitRendering.js';
import {Suite, assertThat} from '../../TestUtil.js';
import {DisplayView, scenePixels} from '../../draw/scene/TestDisplayView.js';
import {CircuitViewState} from '../../../src/editor/state/CircuitViewState.js';
import {CircuitDefinition} from '../../../src/circuit/model/CircuitDefinition.js';
import {CircuitStats} from '../../../src/engine/simulation/CircuitStats.js';
import {Gates} from '../../../src/gates/AllGates.js';
import {PointerInteractionState} from '../../../src/editor/interaction/PointerInteractionState.js';
import {drawCircuitTooltip} from '../../../src/editor/rendering/previews/CircuitPreview.js';
import {Rect} from '../../../src/geometry/Rect.js';
import {labelsIn} from './RenderingTestUtil.js';
import {selectionRect} from '../../../src/editor/interaction/RangeSelection.js';
import {Point} from '../../../src/geometry/Point.js';

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

suite.test('a selection is outlined around its gates, and a box being dragged is outlined in its place', async () => {
    const definition = CircuitDefinition.fromTextDiagram(new Map([['H', Gates.HalfTurns.H], ['-', undefined]]), 'H-\n-H');
    const circuit = CircuitViewState.empty(20).withCircuit(definition);
    const geometry = circuit.geometry();
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const view = new DisplayView(canvas);
    const stats = CircuitStats.fromCircuitAtTime(definition, 0);
    // A strip along the top edge of a range's outline, clear of the wires and the gates.
    const topEdge = async range => {
        const rect = selectionRect(geometry, range);
        return [...(await scenePixels(canvas, Math.round(rect.x + 4), Math.floor(rect.y), 12, 1)).data];
    };
    const first = {colStart: 0, colEnd: 1, wireStart: 0, wireEnd: 1};
    const second = {colStart: 1, colEnd: 2, wireStart: 1, wireEnd: 2};

    paintCircuit(circuit, view, PointerInteractionState.EMPTY, stats, false, true, undefined, []);
    const plain = [await topEdge(first), await topEdge(second)];

    view.begin();
    paintCircuit(circuit, view, PointerInteractionState.EMPTY, stats, false, true, undefined, [], first);
    assertThat(await topEdge(first)).isNotEqualTo(plain[0]);
    assertThat(await topEdge(second)).isEqualTo(plain[1]);

    // While a box is dragged over the second gate, it is outlined instead of the selection.
    const centre = geometry.gateRect(1, 1).center();
    const boxing = PointerInteractionState.EMPTY.withPos(new Point(centre.x, centre.y)).withSelectingRange(centre);
    view.begin();
    paintCircuit(circuit, view, boxing, stats, false, true, undefined, [], first);
    assertThat(await topEdge(first)).isEqualTo(plain[0]);
    assertThat(await topEdge(second)).isNotEqualTo(plain[1]);
});
