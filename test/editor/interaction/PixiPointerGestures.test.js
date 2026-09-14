import {Container} from 'pixi.js';
import {Suite, assertThat} from '../../TestUtil.js';
import {watchPixiPointerDrags} from '../../../src/editor/interaction/PixiPointerGestures.js';
const suite = new Suite('PixiPointerGestures');
suite.test('one pointer owns the drag until outside release or cancellation', () => {
    const stage = new Container();
    const log = [];
    const gestures = watchPixiPointerDrags(stage, {
        onGrab: () => log.push('grab'), onDrag: () => log.push('move'),
        onDrop: () => log.push('drop'), onCancel: () => log.push('cancel')
    }, e => e.global);
    const event = {pointerId: 1, isPrimary: true, button: 0, buttons: 1, pointerType: 'mouse', global: {x: 1, y: 2}};
    stage.emit('pointerdown', event);
    stage.emit('globalpointermove', {...event, pointerId: 2});
    stage.emit('globalpointermove', event);
    stage.emit('pointerupoutside', event);
    stage.emit('pointerup', event);
    stage.emit('pointerdown', event);
    gestures.cancel({...event, pointerId: 2});
    gestures.cancel(event);
    gestures.cancel(event);
    stage.emit('pointerup', event);
    stage.emit('pointerdown', {...event, pointerId: 3});
    stage.emit('pointerup', {...event, pointerId: 3});
    gestures.dispose();
    stage.emit('pointerdown', event);
    assertThat(log).isEqualTo(['grab', 'move', 'drop', 'grab', 'cancel', 'grab', 'drop']);
    stage.destroy();
});
