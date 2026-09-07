import {gateStyle} from '../../../src/config/CanvasTheme.js';
import {rectangle} from '../../../src/draw/pixi/ShapeView.js';
import {Suite, assertThat} from '../../TestUtil.js';
import {GatePainting} from '../../../src/draw/gate/GatePainting.js';
import {DisplayView, scenePixels} from '../TestDisplayView.js';
import {Rect} from '../../../src/geometry/Rect.js';
import {Gates} from '../../../src/gates/AllGates.js';

let suite = new Suite("GatePainting");

suite.test("IQP-dark gate backgrounds and ink reach the painter and survive hover", async () => {
    for (const gate of [Gates.HalfTurns.H, Gates.HalfTurns.Y, Gates.HalfTurns.Z,
        Gates.QuarterTurns.SqrtZForward, Gates.Special.Measurement]) {
        for (const isHighlighted of [false, true]) {
            const painter = new DisplayView(document.createElement('canvas'));
            const args = {painter, rect: new Rect(10, 10, 40, 40), gate, isHighlighted,
                isResizeShowing: false};
            (gate.customDrawer || GatePainting.DEFAULT_DRAWER)(args);
            const pixel = [...(await scenePixels(painter.canvas, 14, 14, 1, 1)).data];
            const style = gateStyle(gate);
            assertThat(pixel).isEqualTo([...style.fill.slice(1).match(/../g).map(v => parseInt(v, 16)), 255]);
            const data = (await scenePixels(painter.canvas, 18, 18, 24, 24)).data;
            let darkInk = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] < 25 && data[i+1] < 25 && data[i+2] < 25 && data[i+3] === 255) darkInk++;
            }
            assertThat(darkInk > 5).withInfo({gate: gate.serializedId, isHighlighted, darkInk}).isEqualTo(true);
        }
    }
});

suite.test("displayResizeTab_drawsOnceAboveContent", () => {
    for (let highlighted of [false, true]) {
        let painter = new DisplayView(document.createElement('canvas'));
        let args = {
            painter,
            rect: new Rect(10, 10, 80, 80),
            positionInCircuit: {row: 0, col: 0},
            isHighlighted: highlighted,
            isResizeShowing: true,
            isResizeHighlighted: highlighted,
            gate: {canChangeInSize: () => true, canIncreaseInSize: () => true, canDecreaseInSize: () => true}
        };
        GatePainting.makeDisplayDrawer(a => rectangle(a.painter, a.rect, {fill: 'black'}))(args);
        const fills = [];
        const collect = (node, alpha = 1) => {
            alpha *= node.alpha;
            if (node.values?.[0] === 'rect' && node.context.instructions.some(i => i.action === 'fill')) {
                fills.push({rect: new Rect(...node.values.slice(1, 5)), alpha});
            }
            for (const child of node.children || []) collect(child, alpha);
        };
        collect(painter);
        assertThat(fills.length).isEqualTo(2);
        assertThat(fills[0].rect).isEqualTo(args.rect);
        assertThat(fills[1].rect).isEqualTo(GatePainting.rectForResizeTab(args.rect).skipLeft(2).skipRight(2));
        assertThat(fills[1].alpha).isApproximatelyEqualTo(highlighted ? 1 : 0.7);
        assertThat(painter.alpha).isEqualTo(1);
    }
});
