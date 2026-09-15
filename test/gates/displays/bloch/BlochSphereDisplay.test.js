import {Suite, assertThat, assertTrue} from '../../../TestUtil.js';
import { paintBlochSphereDisplay } from "../../../../src/draw/displays/bloch/BlochView.js";
import {CircuitGeometry} from '../../../../src/editor/geometry/CircuitGeometry.js';
import {Layout} from '../../../../src/config/Layout.js';
import {CanvasTheme} from '../../../../src/config/CanvasTheme.js';
import {DisplayView} from '../../../draw/scene/TestDisplayView.js';
import {Rect} from '../../../../src/geometry/Rect.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {DEFAULT_VIEW, projectPoint} from '../../../../src/draw/displays/bloch/BlochScene.js';

const suite = new Suite("BlochSphereDisplay");

suite.test("shell stays visible for mixed states and readout stays below it at different scales", async () => {
    for (const scale of [0.5, 1, 1.5]) {
        for (const density of [Matrix.square(1, 0, 0, 0), Matrix.identity(2).times(0.5)]) {
            const painter = new DisplayView(document.createElement('canvas'));
            let bounds = CircuitGeometry.blochDisplayRect(new Rect(40, 40, Layout.UNIT, Layout.UNIT));
            bounds = new Rect(bounds.x, bounds.y, bounds.w * scale, bounds.h * scale);
            paintBlochSphereDisplay(painter, density, bounds);
            await painter.commit();
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
            // Each letter wears its axis's colour, the one the enlarged view gives that axis.
            assertThat(labels.slice(0, 3).map(label => [label.text, JSON.parse(label.appearanceKey)[2]])).
                isEqualTo([['X', CanvasTheme.bloch.axisX], ['Y', CanvasTheme.bloch.axisY],
                    ['Z', CanvasTheme.bloch.axisZ]]);
            const readout = labels.find(label => label.text.startsWith('|r|'));
            assertTrue(readout.y - readout.height > shell.node.values[2] + shell.node.values[3]);
        }
    }
});

suite.test("the circuit's sphere points its axes the way the analyzer it opens does", async () => {
    const painter = new DisplayView(document.createElement('canvas'));
    const bounds = CircuitGeometry.blochDisplayRect(new Rect(40, 40, Layout.UNIT, Layout.UNIT));
    paintBlochSphereDisplay(painter, Matrix.square(1, 0, 0, 0), bounds);
    await painter.commit();
    const nodes = [];
    const collect = node => {
        nodes.push(node);
        for (const child of node.children || []) collect(child);
    };
    collect(painter);
    const shell = nodes.find(node => node.values?.[0] === 'circle' &&
        node.context.instructions.some(i => i.action === 'stroke'));
    const [cx, cy] = [shell.values[1], shell.values[2]];
    // Each letter sits in the direction the analyzer's default view projects that axis.
    for (const [label, dir] of [['X', [1, 0, 0]], ['Y', [0, 1, 0]], ['Z', [0, 0, 1]]]) {
        const node = nodes.find(n => n.text === label);
        const p = projectPoint(...dir, DEFAULT_VIEW.yaw, DEFAULT_VIEW.pitch);
        const drawn = Math.atan2(-(node.y - cy), node.x - cx);
        assertThat(drawn).withInfo({label}).isApproximatelyEqualTo(Math.atan2(p.sy, p.sx), 0.05);
    }
});
