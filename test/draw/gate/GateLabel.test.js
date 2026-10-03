import {Suite, assertThat} from '../../TestUtil.js';
import {layoutGateLabel, paintGateLabel} from '../../../src/draw/gate/GateLabel.js';
import {RenderSurface} from '../../../src/draw/surface/RenderSurface.js';
import {Rect} from '../../../src/geometry/Rect.js';
import {Typography} from '../../../src/config/Typography.js';

const suite = new Suite('GateLabel');

const at = (x, y, scale = 1) => ({x, y, scale});
const run = (width, height, fontSize, exponent = false) => ({width, height, fontSize, exponent});

// The expected places in these tests come from the flexbox engine (Yoga, through Pixi Layout) that
// laid gate labels out before layoutGateLabel did, given the same boxes.

suite.test('a lone run is centred in the box, in a row 1.4 times its font size tall', () => {
    assertThat(layoutGateLabel(36, 36, [[run(11.56, 18.54, 16)]])).isApproximatelyEqualTo([[at(12.22, 8.73)]]);
});

suite.test('an exponent sits at the top left of its box, above the base, which is lowered a little', () => {
    const [[base, exponent]] = layoutGateLabel(36, 36, [[run(10.68, 18.54, 16), run(13.34, 18.54, 16, true)]]);
    assertThat(base).isApproximatelyEqualTo(at(6.16, 11.23));
    assertThat(exponent).isApproximatelyEqualTo(at(17, 5));
    assertThat(exponent.y < base.y).isEqualTo(true);
});

suite.test('rows are stacked as a block in the middle, a unit apart', () => {
    assertThat(layoutGateLabel(34, 50, [[run(20, 19, 17)], [run(17, 14, 12)]])).
        isApproximatelyEqualTo([[at(7, 6.5)], [at(9, 30.5)]]);
});

suite.test('rows shrink together when they and their gaps overflow the box', () => {
    const squeezed = layoutGateLabel(34, 34, [[run(20, 19, 17)], [run(17, 14, 12)]]);
    assertThat(squeezed).isApproximatelyEqualTo([[at(7, 0)], [at(9, 20)]]);
    // A box with no room at all leaves rows nothing, and nothing becomes negative or not a number.
    for (const row of layoutGateLabel(34, 0.5, [[run(20, 19, 17)], [run(17, 14, 12)]])) {
        for (const {x, y, scale} of row) {
            assertThat([x, y, scale].every(Number.isFinite)).isEqualTo(true);
            assertThat(scale >= 0).isEqualTo(true);
        }
    }
});

suite.test('text wider than its box is scaled down to fit, and text that fits is never scaled up', () => {
    assertThat(layoutGateLabel(36, 36, [[run(80, 18.54, 16)]])).isApproximatelyEqualTo([[at(0, 13.8285, 0.45)]]);
    assertThat(layoutGateLabel(36, 36, [[run(4, 6, 16)]])[0][0].scale).isEqualTo(1);
});

suite.test('runs that overflow their row shrink in proportion to their widths', () => {
    assertThat(layoutGateLabel(36, 36, [[run(30, 18.54, 16), run(30, 18.54, 16, true)]])).
        isApproximatelyEqualTo([[at(0, 14.938, 0.6), at(18, 5, 0.6)]]);
});

suite.test('an empty run is laid out where its box is, not nowhere', () => {
    const [[empty]] = layoutGateLabel(36, 36, [[run(0, 0, 16)]]);
    assertThat([empty.x, empty.y, empty.scale].every(Number.isFinite)).isEqualTo(true);
});

suite.test('gate labels are label views in the gate, positioned by the layout, with no layout engine', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const surface = new RenderSurface(canvas);
    const labelsIn = node => node.text === undefined ? node.children.flatMap(labelsIn) : [node];
    const font = {fontSize: 16, fontFamily: Typography.DEFAULT_FONT_FAMILY};
    try {
        const rect = new Rect(20, 30, 60, 40);
        const view = surface.beginFrame();
        paintGateLabel(view, rect, [[{text: 'X', font}], [{text: 'mod 3', font}]], '#336699');
        await surface.render();
        const labels = labelsIn(surface.app.stage);
        assertThat(labels.map(label => label.text)).isEqualTo(['X', 'mod 3']);
        assertThat(labels.every(label => label.layout === undefined)).isEqualTo(true);
        // The rows sit one above the other, each centred across the rect.
        const [x, mod] = labels.map(label => label.getBounds());
        assertThat(x.maxY <= mod.y).isEqualTo(true);
        for (const bounds of [x, mod]) {
            assertThat(Math.abs((bounds.x + bounds.maxX) / 2 - rect.center().x) <= 0.5).withInfo({bounds}).isEqualTo(true);
            assertThat(bounds.y >= rect.y && bounds.maxY <= rect.bottom()).withInfo({bounds}).isEqualTo(true);
        }
    } finally {
        await surface.destroy();
    }
});
