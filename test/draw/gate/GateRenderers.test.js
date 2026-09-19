import {CanvasTheme, gateStyle} from '../../../src/config/CanvasTheme.js';
import {rectangle} from '../../../src/draw/shapes/ShapeView.js';
import {Suite, assertThat} from '../../TestUtil.js';
import {DEFAULT_RENDERER, makeDisplayRenderer} from '../../../src/draw/gate/GateRenderers.js';
import {rectForResizeTab} from '../../../src/draw/gate/GateRects.js';
import {DisplayView, scenePixels} from '../scene/TestDisplayView.js';
import {Rect} from '../../../src/geometry/Rect.js';
import {Gates} from '../../../src/gates/AllGates.js';
import {Layout} from '../../../src/config/Layout.js';
import {angleLabelParts} from '../../../src/draw/gate/AngleGateLabel.js';
import {labelsIn} from '../../editor/rendering/RenderingTestUtil.js';

const suite = new Suite("GateRenderers");

suite.test("IQP-dark gate backgrounds and ink reach the painter and survive hover", async () => {
    for (const gate of [Gates.HalfTurns.H, Gates.HalfTurns.Y, Gates.HalfTurns.Z,
        Gates.QuarterTurns.SqrtZForward, Gates.Special.Measurement]) {
        for (const isHighlighted of [false, true]) {
            const painter = new DisplayView(document.createElement('canvas'));
            const args = {painter, rect: new Rect(10, 10, 40, 40), gate, isHighlighted,
                isResizeShowing: false};
            (gate.customRenderer || DEFAULT_RENDERER)(args);
            const pixel = [...(await scenePixels(painter.canvas, 14, 14, 1, 1)).data];
            const style = gateStyle(gate);
            assertThat(pixel).isEqualTo([...style.fill.slice(1).match(/../g).map(v => Number.parseInt(v, 16)), 255]);
            const data = (await scenePixels(painter.canvas, 18, 18, 24, 24)).data;
            let darkInk = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] < 25 && data[i+1] < 25 && data[i+2] < 25 && data[i+3] === 255) darkInk++;
            }
            assertThat(darkInk > 5).withInfo({gate: gate.serializedId, isHighlighted, darkInk}).isEqualTo(true);
        }
    }
});

suite.test("resize tabs stay inside the bottom quarter of small, wide and tall gates", () => {
    for (const [width, height] of [[40, 40], [120, 40], [120, 152], [280, 376]]) {
        const gate = new Rect(10, 20, width, height);
        const tab = rectForResizeTab(gate);
        assertThat(tab.x >= gate.x && tab.right() <= gate.right()).isEqualTo(true);
        assertThat(tab.y >= gate.y && tab.bottom() <= gate.bottom()).isEqualTo(true);
        assertThat(tab.containsPoint(gate.bottomLeft().offsetBy(width / 2, 1))).isEqualTo(false);
        // The rest of the gate still grabs the gate itself, even when it spans a single wire.
        assertThat(tab.y >= gate.y + height * 3 / 4).withInfo({width, height}).isEqualTo(true);
    }
});

suite.test("displayResizeTab_drawsOnceAboveContent", async () => {
    for (const highlighted of [false, true]) {
        const painter = new DisplayView(document.createElement('canvas'));
        const args = {
            painter,
            rect: new Rect(10, 10, 80, 80),
            positionInCircuit: {row: 0, col: 0},
            isHighlighted: highlighted,
            isResizeShowing: true,
            isResizeHighlighted: highlighted,
            gate: {canChangeInSize: () => true, canIncreaseInSize: () => true, canDecreaseInSize: () => true}
        };
        makeDisplayRenderer(a => rectangle(a.painter, a.rect, {fill: 'black'}))(args);
        await painter.commit();
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
        assertThat(fills[1].rect).isEqualTo(rectForResizeTab(args.rect).paddedBy(-2));
        assertThat(fills[1].alpha).isApproximatelyEqualTo(highlighted ? 1 : 0.7);
        assertThat(painter.alpha).isEqualTo(1);
    }
});

suite.test("display gates always wear a frame, and a highlight ring outside it while hovered", async () => {
    for (const isHighlighted of [false, true]) {
        const painter = new DisplayView(document.createElement('canvas'));
        const rect = new Rect(10.5, 10.5, 80, 80);
        makeDisplayRenderer(() => {})({painter, rect, isHighlighted, isResizeShowing: false,
            positionInCircuit: {row: 0, col: 0}, gate: {canChangeInSize: () => false}});
        await painter.commit();
        // Frames and rings are rounded tiles; the ring's corner follows the frame's, outside it.
        const strokes = [];
        const collect = node => {
            if (node.values?.[0] === 'roundRect' && node.values[7] !== undefined) strokes.push(node.values.slice(1));
            for (const child of node.children || []) collect(child);
        };
        collect(painter);
        const expected = [[10.5, 10.5, 80, 80, 6, undefined, CanvasTheme.stroke.displayFrame, 1]];
        if (isHighlighted) expected.push([9, 9, 83, 83, 7.5, undefined, CanvasTheme.interaction.outline, 2]);
        assertThat(strokes).withInfo({isHighlighted}).isEqualTo(expected);
    }
});

suite.test("rotation gates keep their symbol and angle inside the gate at each zoom step", async () => {
    for (const gate of [Gates.RotationGates.Rx.withParam('pi/2'), Gates.RotationGates.Ry.withParam('3pi/4'),
        Gates.RotationGates.Rz.withParam('-pi/8')]) {
        for (const scale of [0.8, 1, 1.5]) {
            const canvas = document.createElement('canvas');
            const painter = new DisplayView(canvas);
            const size = Layout.GATE_RADIUS * 2 * scale;
            const rect = new Rect(30, 30, size, size);
            gate.customRenderer({painter, rect, gate, isHighlighted: false, isResizeShowing: false,
                hand: {isHoldingSomething: () => false}, focusPoints: [], stats: {time: 0}});
            const pixels = (await scenePixels(canvas)).data;
            const {symbol, parameter} = angleLabelParts(gate);
            assertThat(labelsIn(painter).map(label => label.text)).withInfo({scale}).
                isEqualTo([symbol, parameter, 'edit']);
            let outside = 0;
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const near = x >= rect.x - 2 && x < rect.right() + 2 && y >= rect.y - 2 && y < rect.bottom() + 2;
                    if (!near && pixels[(y * canvas.width + x) * 4 + 3] !== 0) outside++;
                }
            }
            assertThat(outside).withInfo({gate: gate.symbol, scale}).isEqualTo(0);
        }
    }
});
