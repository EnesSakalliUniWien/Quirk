import {Suite, assertThat} from '../../../TestUtil.js';
import {DisplayView, scenePixels} from '../../../draw/scene/TestDisplayView.js';
import {drawGate_disabledReason} from '../../../../src/editor/rendering/columns/CircuitWarnings.js';
import {rectangle} from '../../../../src/draw/shapes/ShapeView.js';
import {CanvasTheme} from '../../../../src/config/CanvasTheme.js';
import {Rect} from '../../../../src/geometry/Rect.js';
import {labelsIn} from '../RenderingTestUtil.js';

const suite = new Suite('CircuitWarnings');

suite.test('a disabled gate stays in sight under a veil, its reason inside its own bounds', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    const rect = new Rect(30, 30, 100, 60);
    let reason = 'Unavailable';
    const context = {definition:{gateAtLocIsDisabledReason:() => reason}};
    const hex = color => color.slice(1, 7).match(/../g).map(v => Number.parseInt(v, 16));
    const near = (pixel, color) => Math.hypot(...pixel.slice(0, 3).map((v, i) => v - color[i]));
    const gate = [0, 255, 0];
    rectangle(view, rect, {fill:'#00ff00'});
    drawGate_disabledReason(context, view, 0, 0, rect);
    // A mistake veils the gate in the error's background, mostly, so the gate still shows through.
    const pixel = [...(await scenePixels(view.canvas, 40, 40, 1, 1)).data];
    const errorBackground = hex(CanvasTheme.error.background);
    assertThat(near(pixel, errorBackground) < near(pixel, gate)).withInfo({pixel}).isEqualTo(true);
    assertThat(near(pixel, errorBackground) > 0).withInfo({pixel}).isEqualTo(true);
    const label = labelsIn(view).find(label => label.text === reason);
    const bounds = label.getBounds();
    assertThat(bounds.x >= rect.x && bounds.maxX <= rect.right() &&
        bounds.y >= rect.y && bounds.maxY <= rect.bottom()).isEqualTo(true);
    // Nothing is drawn past the gate's own edge.
    assertThat([...(await scenePixels(view.canvas, rect.x - 3, rect.y - 3, 1, 1)).data]).isEqualTo([0, 0, 0, 0]);

    // A gate waiting for its input is veiled in the canvas's own background, and says what to add.
    reason = 'Add input A\nto this column';
    view.begin();
    rectangle(view, rect, {fill:'#00ff00'});
    drawGate_disabledReason(context, view, 0, 0, rect);
    const waiting = [...(await scenePixels(view.canvas, 40, 40, 1, 1)).data];
    assertThat(near(waiting, hex(CanvasTheme.surface.background)) < near(waiting, gate)).withInfo({waiting}).isEqualTo(true);
    assertThat(labelsIn(view).some(label => label.text.startsWith('Add input'))).isEqualTo(true);

    reason = undefined;
    view.begin();
    drawGate_disabledReason(context, view, 0, 0, rect);
    assertThat([...(await scenePixels(view.canvas,36,32,1,1)).data]).isEqualTo([0,0,0,0]);
});

