import {Suite, assertThat, assertTrue} from '../../TestUtil.js';
import {paintBlochSphereDisplay} from '../../../src/gates/displays/BlochSphereDisplay.js';
import {CircuitGeometry} from '../../../src/editor/CircuitGeometry.js';
import {Layout} from '../../../src/config/Layout.js';
import {DisplayView} from '../../draw/TestDisplayView.js';
import {Rect} from '../../../src/geometry/Rect.js';
import {Matrix} from '../../../src/engine/math/matrix/Matrix.js';

let suite = new Suite("BlochSphereDisplay");

suite.test("shell stays visible for mixed states and readout stays below it at different scales", () => {
    for (let scale of [0.5, 1, 1.5]) {
        for (let density of [Matrix.square(1, 0, 0, 0), Matrix.identity(2).times(0.5)]) {
            let painter = new DisplayView(document.createElement('canvas'));
            let bounds = CircuitGeometry.blochDisplayRect(new Rect(40, 40, Layout.UNIT, Layout.UNIT));
            bounds = new Rect(bounds.x, bounds.y, bounds.w * scale, bounds.h * scale);
            paintBlochSphereDisplay(painter, density, bounds);
            const nodes = [];
            const collect = (node, alpha = 1) => {
                alpha *= node.alpha;
                nodes.push({node, alpha});
                for (const child of node.children || []) collect(child, alpha);
            };
            collect(painter);
            const shell = nodes.find(({node}) => node.values?.[0] === 'circle' &&
                node.context.instructions.some(i => i.action === 'stroke'));
            assertThat(shell.node.values[3] + 0.5).isApproximatelyEqualTo(Layout.BLOCH_RADIUS * scale);
            assertThat(shell.alpha).isEqualTo(1);
            const labels = nodes.filter(({node}) => typeof node.text === 'string').map(({node}) => node);
            assertThat(labels.slice(0, 3).map(label => label.text)).isEqualTo(['X', 'Y', 'Z']);
            const readout = labels.find(label => label.text.startsWith('|r|'));
            assertTrue(readout.y - readout.height > shell.node.values[2] + shell.node.values[3]);
        }
    }
});
