import {Suite, assertThat} from '../../TestUtil.js';
import {CircuitViewport} from '../../../src/app/canvas/CircuitViewport.js';
import {EditorState} from '../../../src/editor/state/EditorState.js';
import {CircuitStats} from '../../../src/engine/simulation/CircuitStats.js';
import {RestartableRng} from '../../../src/base/RestartableRng.js';
import {Rect} from '../../../src/geometry/Rect.js';
import {DisplayView} from '../../draw/scene/TestDisplayView.js';

const suite = new Suite('CircuitViewport');

suite.test('offsets the frame by the scroll, stamps the circuit and renders the editor layers', () => {
    const view = new DisplayView(document.createElement('canvas'));
    const frames = [];
    const surface = {beginFrame: (...args) => { frames.push(args); return view.begin(...args); }};
    const shown = EditorState.empty(new Rect(0, 0, 600, 300));
    const stats = CircuitStats.withNanDataFromCircuitAtTime(shown.displayedCircuit.circuitDefinition, 0);
    const rng = new RestartableRng();

    const frame = new CircuitViewport(surface).update(shown, stats, 0,
        {rng, resolution: 2, lineScale: 1.5, scrollX: 30, scrollY: 12});

    assertThat(frame === view).isEqualTo(true);
    assertThat(frames.length).isEqualTo(1);
    assertThat(frames[0][0] === rng).isEqualTo(true);
    assertThat(frames[0].slice(1)).isEqualTo([2, 1.5]);
    assertThat([view.position.x, view.position.y]).isEqualTo([-30, -12]);
    assertThat(view.circuit).isEqualTo(shown.snapshot());
    assertThat(view.elements.map(element => element.key).slice(-3)).isEqualTo(['circuit', 'held-gates', 'interaction']);
});
