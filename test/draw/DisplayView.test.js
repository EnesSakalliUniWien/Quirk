import {BasisLabels} from '../../src/draw/pixi/BasisLabels.js';
import {drawText} from '../../src/draw/pixi/TextLayout.js';
/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {PathGeometry} from '../../src/draw/pixi/PathGeometry.js';
import {drawPath, rectangle, circle, strokePath, polygon} from '../../src/draw/pixi/ShapeView.js';
import {fitLine} from '../../src/draw/pixi/TextLayout.js';
import {drawingArea} from '../../src/draw/pixi/DisplayView.js';

import {Suite, assertThat} from '../TestUtil.js';
import {RenderSurface} from '../../src/draw/pixi/RenderSurface.js';
import {DisplayView, scenePixels} from './TestDisplayView.js';

import {Point} from '../../src/math/Point.js';
import {Rect} from '../../src/math/Rect.js';

let suite = new Suite("DisplayView");

suite.test("paintableArea", () => {
    let c = /** @type !HTMLCanvasElement */ document.createElement("canvas");
    c.width = 23;
    c.height = 34;
    assertThat(drawingArea(new DisplayView(c))).isEqualTo(new Rect(0, 0, 23, 34));
});

//noinspection SpellCheckingInspection
suite.canvasAppearanceTest("clear", 20, 20, canvas => {
    let painter = new DisplayView(canvas);
    rectangle(painter, drawingArea(painter), {fill: '#123456'});
}, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAHklEQVQ4jWMQMgn7T03MMGrgqIGjBo4aOGrgSDUQACM' +
'egk9y1eLzAAAAAElFTkSuQmCC');

//noinspection SpellCheckingInspection
suite.canvasAppearanceTest("strokeRect", 40, 40, canvas => {
    let painter = new DisplayView(canvas);
    rectangle(painter, new Rect(5, 10, 15, 20), {stroke: {color: "blue", width: 4}});
    rectangle(painter, new Rect(2.5, 3.5, 5, 17), {stroke: {color: "red", width: 1}});
    rectangle(painter, new Rect(20, 30, 5, 7), {stroke: {color: "red", width: 1}});
}, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAkUlEQVRYhe3UQQqEMBBE0TpajlY3y9FqViOO9MJQkUS' +
'mPvTGhf1AWiD9SwJUzWrXUYUJcKQA3VTcSfXs/gQY4Czg7TcEGGCAAb4eWM02QH9JgO6SAN0lAbpLlgCd2RDY0EVQBCWAp2lbAAmqo12BXQC3ARL8+cR' +
'f6CSgV4UJcKQA3c5X+9AVewloF9zs/2Aa7gP137GCEm+UmAAAAABJRU5ErkJggg==');

suite.test("roundedRectFillAndClip", async () => {
    let fillCanvas = /** @type !HTMLCanvasElement */ document.createElement("canvas");
    fillCanvas.width = 24;
    fillCanvas.height = 24;
    let fillPainter = new DisplayView(fillCanvas);
    rectangle(fillPainter, new Rect(2, 2, 20, 20), {fill: "red"}, 6);

    let pixelAt = (imageData, x, y) => {
        let i = (y * imageData.width + x) * 4;
        return Array.from(imageData.data.slice(i, i + 4));
    };
    let fillData = await scenePixels(fillCanvas);
    let fillPixel = (x, y) => pixelAt(fillData, x, y);
    assertThat(fillPixel(12, 12)).isEqualTo([255, 0, 0, 255]);
    assertThat(fillPixel(12, 2)).isEqualTo([255, 0, 0, 255]);
    assertThat(fillPixel(2, 2)).isEqualTo([0, 0, 0, 0]);

    let clipCanvas = /** @type !HTMLCanvasElement */ document.createElement("canvas");
    clipCanvas.width = 24;
    clipCanvas.height = 24;
    let clipPainter = new DisplayView(clipCanvas);
    const mask = rectangle(clipPainter, new Rect(2, 2, 20, 20), {fill: 'white'}, 6);
    clipPainter.group('clipped', painter => {
        painter.mask = mask;
        rectangle(painter, new Rect(0, 0, 24, 24), {
            fill: 'blue'
        });
    });

    let clipData = await scenePixels(clipCanvas);
    let clipPixel = (x, y) => pixelAt(clipData, x, y);
    assertThat(clipPixel(12, 12)).isEqualTo([0, 0, 255, 255]);
    assertThat(clipPixel(2, 2)).isEqualTo([0, 0, 0, 0]);
});

//noinspection SpellCheckingInspection
suite.canvasAppearanceTest("strokeCircle", 40, 40, canvas => {
    let painter = new DisplayView(canvas);
    circle(painter, new Point(5, 10), 15, {stroke: {color: "blue", width: 3}});
    circle(painter, new Point(20, 13), 5, {stroke: {color: "green", width: 1}});
}, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAABdklEQVRYhe2XMUtCURSAP2pqsSkoLJwC/0OzDS9rT2i' +
'LVolwelCXcFGHpvwB/QYbw8WpocnBUUyEGl0TT8O7wrV3pRD03uB+cJb74N2PezjnngtLIUWQKYjoeFnuPytFioaggNy7NrIgZUNwArLv2siCdAzJR9c' +
'2FiQyBMeubRYgXUMycm1jQWqGYNO1jYW5Ymm7tklzcXxF6US42RMqO18oWig8SbWiwd3GO4WKsN0Xsq8PKOooBigaruUiFAPOT/OpSq6S1ZIOTzJJZR3' +
'EFOwZ3+soWi4FR8TkFhZJlRwK5YOgvc3E5FCMXArOUmxv1B6kOCLe+iQzTF91XhQJwNnlkOsDoVARdt+edFo9aTOz4jh8FkrRlNvNDxQjTxq11wOr1yP' +
'/XM8TkD5I1rUVejDtWOSOVr1xVzfasr6yMjryeq32o88ZaV3LyaU2/i0may6IP4uNk0fR2l9uEiX3p7STSUTGOnp6renpOyMQCAQCgUDgH/ANRQswZ2g' +
'MMfAAAAAASUVORK5CYII=');

//noinspection SpellCheckingInspection
suite.canvasAppearanceTest("fillCircle", 40, 40, canvas => {
    let painter = new DisplayView(canvas);
    circle(painter, new Point(5, 10), 15, {fill: "blue"});
    circle(painter, new Point(20, 13), 5, {fill: "green"});
}, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAA/0lEQVRYhe3WIWtCYRSH8ScsGMyXpYFZ65phLM4yLIp' +
'pwTAVsfgBXr+DWBZkcR9ADGbBbtgnsFgWjX+D9wZFFLx4PZPzwEm3/Lgv7+EFpBQzARW5bqmAAs1AD5aBAnWtA+egJ8tAgZrWgT/WgStQwTJQoFe7wGg' +
'pqo0vAk0CJTvA3J94/xCBwxkTyN8e+NY5hktmeFtgtDyFSybtcacAPo/OAwe0HPh/jxiJStvwJUnWTK26trtmdtMjUIqXtLFFbfzBavrJ/wt6vDLuYuB' +
'3Bn/uIuAC1ANFGeEANAVtTqA28UX4BOUyhO0h86AXUB3Uj6cOKu++eZ7neZ7neXfaFuFxi8XufliHAAAAAElFTkSuQmCC');

//noinspection SpellCheckingInspection
suite.canvasAppearanceTest("printLine_simple", 40, 40, canvas => {
    let painter = new DisplayView(canvas);
    let r = new Rect(5, 5, 30, 30);
    rectangle(painter, r, {stroke: {color: "green", width: 1}});
    let used = fitLine(painter, "test", r, {
        horizontal: 0,
        fill: "black",
        maxFontSize: 12,
        fontFamily: "monospace"
    });
    assertThat(used).isApproximatelyEqualTo(new Rect(5, 18.5, 28, 12), 2.5);
}, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAA1klEQVRYhe2YwQ3CMAxF/zaskVPFIB0kl06SQbhkEhY' +
'pBwo1lgkpTkmF/o96iB39/+SoPRSgqKMpIiB2W6EGMCLi0gHunlkJWHGwsapzCejNJaA3l4DeXAJ6cwnozSWgN5eA3tzXg3kHFNtzE+AZCcCsHmk8qp6' +
'W7KWlNhQ9G09Q1k8ArmI/LTWr996zIaA1iVlByfrQA3D8bPTUrhNMopOxTkOHlgD03vb8EnDCelVyavoa5YuSUb5i2/Nfv4O/EwG9IqBXGwEP/fModIB' +
'7rOC8B4pqrhsoxyh6D5LV0gAAAABJRU5ErkJggg==',
    1000); // Text rendering differs quite a bit from system to system... hard to test it effectively.

//noinspection SpellCheckingInspection
suite.canvasAppearanceTest("printLine_aligned", 40, 40, canvas => {
    let painter = new DisplayView(canvas);
    rectangle(painter, drawingArea(painter), {fill: "gray"});
    let used1 = fitLine(painter, "A", new Rect(0, 0, 40, 40).leftHalf(), {
        horizontal: 0,
        fill: "red",
        maxFontSize: 24,
        fontFamily: "monospace"
    });
    let used2 = fitLine(painter, "long", new Rect(0, 0, 40, 40).rightHalf(), {
        horizontal: 1,
        fill: "green",
        maxFontSize: 24,
        fontFamily: "monospace"
    });
    assertThat(used1).isApproximatelyEqualTo(new Rect(0, 12, 14.4, 24), 3);
    assertThat(used2).isApproximatelyEqualTo(new Rect(20, 23.25, 20, 9), 2.5);
}, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAABYUlEQVRYhe3WoW7DMBQF0MdKzIKMwsyCzALDCg2L/QH' +
'5hfsL5cWjY4NlZUNlZWVDQ0FFd6CzV6WNmm7T7EkGV6riqjp+z8+NAGDOkdSAAizA1IACLMDUgAIswNSAAvwz4MEYUuQqx7rOA3iZbddxUIpPqxUpwnX' +
'f5wU81jX3TUMAHJTirm3zAW68J0W48Z4AuGtbvldVPsAxaAxODnyvqquWvmkdW54UODUUYWiSA/dNc/NaWfc9KcJn59ICT4vFzbsw5GDMrB9VUFT4nYp' +
'H4MtyydNiMfnFe+vjGMzbzGzgwZi7FRqU4rbrvgXU0BRIrKyGjs8EQg8fqy8QGpjPtQfO2NQZvQfs0LHDeWMOjhaWHj5iw7qFpYOLUAd3Bs6d0kf++uY' +
'ALewkMHyWQamrYRhfyq/Wzh6Y864lJiButTi09nKoQosF8lXBHGNg8gSGympoAv/phTXXFGABpk4B/jQftjpRyNhAo6oAAAAASUVORK5CYII=',
    1000); // Text rendering differs quite a bit from system to system... hard to test it effectively.

//noinspection SpellCheckingInspection
suite.canvasAppearanceTest("strokePolygon", 40, 40, canvas => {
    let painter = new DisplayView(canvas);
    strokePath(painter, ([
        new Point(2.5, 4.5),
        new Point(22.5, 4.5),
        new Point(14.5, 13),
        new Point(4, 13)
    ]).length ? [([
        new Point(2.5, 4.5),
        new Point(22.5, 4.5),
        new Point(14.5, 13),
        new Point(4, 13)
    ]).at(-1), ...([
        new Point(2.5, 4.5),
        new Point(22.5, 4.5),
        new Point(14.5, 13),
        new Point(4, 13)
    ])] : [], "red", 1);
    strokePath(painter, ([
        new Point(12, 10),
        new Point(39, 34),
        new Point(10, 33)
    ]).length ? [([
        new Point(12, 10),
        new Point(39, 34),
        new Point(10, 33)
    ]).at(-1), ...([
        new Point(12, 10),
        new Point(39, 34),
        new Point(10, 33)
    ])] : [], "blue", 3);
}, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAACYElEQVRYhe2XPWgUURSFv0IJAUGMXYIWUfEHixSJKQT' +
'TRYjiDyRgoeBWoqlE2EJSJCCIRFtjJYtNEAkIajCNiLFxIzbBYmGRoBERCStoLNIci3kJl5fMuJt5M7HYC6/Zd++539y9c9iFZjTjPwjBNoEyOP0hIec' +
'FXQF0jgt+C86H4LLCk4JLCRnddWh0Cb4LLoZkWxW/KbiTkDEAKibUHxB8ElwJDucanBG8SMi47FZrfIPadrci1zOBc006BZ8TMopm/0umbqfgnWAkMzj' +
'T7Kdgd8ztXe8lnT7F812CV4LbmcM5wLeCvpjbR76LHKRSK3OslAucA3wgeCwY9c8RPlZj7G4B1Jsn5Do4wWg7X76tQg3y5LUHuQw6nRtkDPqiAdoTAWn' +
'ZAy1sJeCKAWlxn/W6r9hCxnpllnBtBqDm3XWC5jzIdV6ZNeBh07yywf0O0LQHWcoTsM80nk3IK/leGcFnDzhkmk79I3fcg5yL1iBbwGHTcKKO/KIHuZC' +
'xV2rMNBurs6aQo1dqwjQabqAuL6/UlGkw1GBtHl6pWSMe82MisT5rr1TFCB/apEaWXqmaEW1LqVUK7JVqMWIr6eDWNEN6pfYaocUwgBDQK9VtRD6EA4R' +
'AXqkBI/AyLCAE8Mq1v5sCvQdddU9+AXQW1A86AeoBHQXtA3VEL5Na6+yRxis1CPrlFTd6/oCWQF9BVdA8qAx6A5oBPQU9A/3YpFdqe0rAFKfu0C3QPdB' +
'90EPQpHvyGTeJsptM1U1qyU0uL8A0oVa3kx2g/W5Xe9zungSdcztdAF0D3QCNRENpRjO2Nv4CO0/DOtNuBZYAAAAASUVORK5CYII=',
    400); // Polygon anti-aliasing differs across browser engines and versions.

//noinspection SpellCheckingInspection
suite.canvasAppearanceTest("fillPolygon", 40, 40, canvas => {
    let painter = new DisplayView(canvas);
    polygon(painter, [
        new Point(2.5, 4.5),
        new Point(22.5, 4.5),
        new Point(14.5, 13),
        new Point(4, 13)
    ], {fill: "red"});
    polygon(painter, [
        new Point(12, 10),
        new Point(39, 34),
        new Point(10, 33)
    ], {fill: "blue"});
}, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAABgklEQVRYhe3VIUgDUQDG8X9YGKIYjIIOBBHB4owTjKJ' +
'YxKIomATBMLAIKwvK4ppjRcPQIpoc2AazCoLBOlZETBYxLHyWQx5Dz2333jvDffCFu/Tj7vE9SJLkn0SQExQtdsY2cFMgSy0JUraBWUu4smDYKi4Ajgh' +
'eIuIqgjHrOAPZiIA7E4w7wwXA6oC4S8GUU1wAPAyDfJJWnnL3+xvBrHNcAFwLA7bICKQNrtQhJUFdMO8FFwCnw4BNFr8fV6i/HlPY8YbrLVrvMt+CcnG' +
'rjGjvhw97D1qNWxZEhV/+/hNoK24doHLIEW2D9uMG1v6YxHfQUZzAux63uwQajQP40McFcwqa8A1s93kLXoDmfOGGQB8DXNW+tlKTA+B8bqWyEYA+tlL' +
'LEYGut1LbFoAut1J5S0BXW6kTy0DbW6mqA6Cwt5W6dgQUdrZSTYdAEX0r9ewYKKJtpd48AEW0rVQalDG6AFoyumv0AFQ0WgGdB62BGkYfQS2jHVB+QGS' +
'SJEn+Vb4Ae+TXYBV8z6IAAAAASUVORK5CYII=');

suite.test('retains gate objects across frames and disposes removed gates', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 80; canvas.height = 40;
    const view = new DisplayView(canvas);
    let gate = view.group('gate-0', child => rectangle(child, new Rect(2, 2, 20, 20), {fill: 'red'}));
    const node = gate.children[0];
    assertThat([...(await scenePixels(canvas, 10, 10, 1, 1)).data]).isEqualTo([255, 0, 0, 255]);
    view.begin();
    view.position.set(30, 0);
    const updated = view.group('gate-0', child => rectangle(child, new Rect(2, 2, 20, 20), {fill: 'blue'}));
    assertThat(updated === gate).isEqualTo(true);
    assertThat(updated.children[0] === node).isEqualTo(true);
    assertThat([...(await scenePixels(canvas, 40, 10, 1, 1)).data]).isEqualTo([0, 0, 255, 255]);
    assertThat([...(await scenePixels(canvas, 10, 10, 1, 1)).data]).isEqualTo([0, 0, 0, 0]);
    view.begin();
    view.finish();
    assertThat(node.destroyed).isEqualTo(true);
    assertThat(view.objects.size).isEqualTo(0);
});

suite.test('child views preserve interaction results from preceding siblings', () => {
    const view = new DisplayView(document.createElement('canvas'));
    for (let frame = 0; frame < 2; frame++) {
        view.begin();
        view.interaction.reset();
        view.group('a', child => child.interaction.block({rect: new Rect(0, 0, 10, 10), cursor: 'pointer'}));
        view.group('b', child => child.interaction.cursor = 'move');
        assertThat(view.interaction.touchBlockers.length).isEqualTo(1);
        assertThat(view.interaction.cursor).isEqualTo('move');
    }
});

suite.test('deferred tooltips remain above later siblings with their original transform', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 180; canvas.height = 100;
    const view = new DisplayView(canvas);
    view.group('gate', gate => {
        gate.position.set(10, 10);
        gate.tooltips.show(gate, {
            x: 0,
            y: 20,
            labelText: 'x',
            valueText: 'y',
            backColor: 'blue'
        });
    });
    view.group('later-gate', gate => rectangle(gate, new Rect(0, 0, 180, 100), {fill: 'red'}));
    assertThat([...(await scenePixels(canvas, 8, 8, 1, 1)).data]).isEqualTo([0, 0, 255, 255]);
    assertThat([...(await scenePixels(canvas, 150, 80, 1, 1)).data]).isEqualTo([255, 0, 0, 255]);
});

suite.test('reuses a traced path for the visible stroke above its halo', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 40;
    const view = new DisplayView(canvas);
    drawPath(view, path => PathGeometry.line(path, 5, 20, 35, 20), [{stroke: {color: 'red', width: 8}}, {stroke: {color: 'blue', width: 4}}]);
    assertThat([...(await scenePixels(canvas, 20, 20, 1, 1)).data]).isEqualTo([0, 0, 255, 255]);
    assertThat([...(await scenePixels(canvas, 20, 17, 1, 1)).data]).isEqualTo([255, 0, 0, 255]);
});

suite.test('render surface releases its objects even when disposed during initialization', async () => {
    const canvas = document.createElement('canvas');
    const surface = RenderSurface.forCanvas(canvas);
    assertThat(RenderSurface.forCanvas(canvas) === surface).isEqualTo(true);
    const view = surface.beginFrame();
    rectangle(view, new Rect(0, 0, 10, 10), {fill: 'blue'});
    const node = view.children[0];
    await surface.destroy();
    assertThat(node.destroyed).isEqualTo(true);
    assertThat(canvas.dataset.renderer).isEqualTo(undefined);
    await surface.destroy();
});

suite.test('unchanged fixed shapes retain geometry and changed colours update it', () => {
    const view = new DisplayView(document.createElement('canvas'));
    const bounds = new Rect(2, 3, 20, 10);
    const shape = rectangle(view, bounds, {fill: 'red'});
    const instruction = shape.context.instructions[0];
    view.finish();
    view.begin();
    assertThat(rectangle(view, new Rect(2, 3, 20, 10), {fill: 'red'}) === shape).isEqualTo(true);
    assertThat(shape.context.instructions[0] === instruction).isEqualTo(true);
    view.finish();
    view.begin();
    rectangle(view, bounds, {fill: 'blue'});
    assertThat(shape.context.instructions[0] === instruction).isEqualTo(false);
    assertThat(shape.context.instructions[0].data.style.color).isEqualTo(0x0000ff);
});

suite.test('native parent transforms preserve nested nonuniform scale and rotation', () => {
    const view = new DisplayView(document.createElement('canvas'));
    view.position.set(10, 20);
    view.scale.set(2, 3);
    const child = view.group('rotated', child => {
        child.rotation = Math.PI / 2;
        rectangle(child, new Rect(0, 0, 10, 10), {fill: 'red'});
    });
    const point = child.toGlobal({x: 4, y: 5});
    assertThat(point.x).isApproximatelyEqualTo(0);
    assertThat(point.y).isApproximatelyEqualTo(32);
    const local = child.toLocal(point);
    assertThat(local.x).isApproximatelyEqualTo(4);
    assertThat(local.y).isApproximatelyEqualTo(5);
});

suite.test('basis labels update only after their inputs change and keep placement independent', () => {
    const view = new DisplayView(document.createElement('canvas'));
    let builds = 0;
    const labels = new BasisLabels(() => ({width: 20, height: 20}), child => {
        builds++;
        child.rotation = Math.PI / 2;
        rectangle(child, new Rect(0, 0, 10, 10), {fill: 'red'});
    });
    labels.paint(10, 20, view, 2);
    view.finish();
    const content = view.children[0].children[0];
    const geometry = content.children[0].context.instructions[0];
    view.begin();
    labels.paint(30, 40, view, 2);
    view.finish();
    assertThat(builds).isEqualTo(1);
    assertThat(content.children[0].context.instructions[0] === geometry).isEqualTo(true);
    assertThat(content.toGlobal({x: 0, y: 0}).x).isEqualTo(30);
    labels.clear();
    view.begin();
    labels.paint(30, 40, view, 2);
    assertThat(builds).isEqualTo(2);
});

suite.test('reused labels clear an old stroke when the next appearance has none', () => {
    const view = new DisplayView(document.createElement('canvas'));
    const label = drawText(view, 'click', {stroke: {color: 'red', width: 3}});
    view.finish();
    view.begin();
    assertThat(drawText(view, 'quiet') === label).isEqualTo(true);
    assertThat(label.style.stroke).isEqualTo(undefined);
});

suite.test('tooltip flush is idempotent and an unrequested tooltip leaves on the next frame', () => {
    const view = new DisplayView(document.createElement('canvas'));
    view.tooltips.show(view, {x: 10, y: 80, labelText: 'Amplitude', valueText: '0.5', backColor: 'blue'});
    view.tooltips.flush();
    const tooltip = view.tooltips.children[0];
    view.tooltips.flush();
    assertThat(view.tooltips.children[0] === tooltip).isEqualTo(true);
    view.begin();
    view.tooltips.flush();
    assertThat(view.tooltips.children.length).isEqualTo(0);
    assertThat(tooltip.destroyed).isEqualTo(true);
});
