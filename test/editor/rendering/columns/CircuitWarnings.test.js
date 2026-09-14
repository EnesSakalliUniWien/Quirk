import {Suite, assertThat} from '../../../TestUtil.js';
import {DisplayView, scenePixels} from '../../../draw/scene/TestDisplayView.js';
import {drawGate_disabledReason} from '../../../../src/editor/rendering/columns/CircuitWarnings.js';
import {rectangle} from '../../../../src/draw/shapes/ShapeView.js';
import {CanvasTheme} from '../../../../src/config/CanvasTheme.js';
import {Rect} from '../../../../src/geometry/Rect.js';
import {labelsIn} from '../RenderingTestUtil.js';

const suite = new Suite('CircuitWarnings');

suite.test('disabled reasons stay inside an opaque warning without a diagonal through the message', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    const rect = new Rect(30, 30, 100, 60);
    let reason = 'Unavailable';
    const context = {definition:{gateAtLocIsDisabledReason:() => reason}};
    rectangle(view, rect, {fill:'#00ff00'});
    drawGate_disabledReason(context, view, 0, 0, rect);
    const pixel = [...(await scenePixels(view.canvas, 36, 32, 1, 1)).data];
    const background = CanvasTheme.error.background.slice(1).match(/../g).map(v => Number.parseInt(v,16));
    assertThat(pixel).isEqualTo([...background,255]);
    const label = labelsIn(view).find(label => label.text === reason);
    const bounds = label.getBounds();
    const area = rect.paddedBy(5);
    assertThat(bounds.x >= area.x && bounds.maxX <= area.right() &&
        bounds.y >= area.y && bounds.maxY <= area.bottom()).isEqualTo(true);
    reason = undefined;
    view.begin();
    drawGate_disabledReason(context, view, 0, 0, rect);
    assertThat([...(await scenePixels(view.canvas,36,32,1,1)).data]).isEqualTo([0,0,0,0]);
});
