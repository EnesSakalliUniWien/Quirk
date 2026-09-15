import {Suite, assertThat} from '../../../TestUtil.js';
import {DisplayView} from '../../scene/TestDisplayView.js';
import {paintSampleDisplay} from '../../../../src/draw/displays/probability/SampleView.js';
import {Rect} from '../../../../src/geometry/Rect.js';
import {Layout} from '../../../../src/config/Layout.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';

const suite = new Suite('SampleView');
suite.test('sample fills stay within the gate for single and multiple wires', async () => {
    for (const height of [1, 2, 4]) {
        const view = new DisplayView(document.createElement('canvas'));
        const rect = new Rect(10, 20, 40, 40+(height-1)*Layout.WIRE_SPACING);
        paintSampleDisplay({painter:view, rect, gate:{height}, focusPoints:[],
            positionInCircuit:{row:0,col:0}, customStats:Matrix.col(1),
            stats:{sampleOutcomes:{'0:0':{i:(1<<height)-1,p:1}}}});
        await view.commit();
        const fills = view.children.filter(c => c.values?.[0] === 'rect');
        assertThat(fills.length >= height).isEqualTo(true);
        for (const fill of fills) {
            const [, , y, , h] = fill.values;
            assertThat(y >= rect.y && y+h <= rect.bottom()).isEqualTo(true);
        }
    }
});
