import {Suite, assertThat, assertTrue} from '../../TestUtil.js';
import {drawBlochScene, paintBlochScene, projectPoint, projectionTriangles, coordinatePlaneTriangles} from '../../../src/draw/displays/BlochScene.js';
import {DisplayView} from '../scene/TestDisplayView.js';
import {RenderSurface} from '../../../src/draw/surface/RenderSurface.js';
import {CanvasTheme} from '../../../src/config/CanvasTheme.js';

const suite = new Suite('BlochScene');
suite.test('rotation and resizing preserve the displayed frame until the replacement commits', async () => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '120px';
    canvas.style.height = '120px';
    document.body.appendChild(canvas);
    const surface = RenderSurface.forCanvas(canvas);
    try {
        drawBlochScene(canvas, {x: 1, y: 0, z: 0}, 0, 0);
        await surface.render();
        const ctx = canvas.getContext('2d');
        const background = [...ctx.getImageData(2, 2, 1, 1).data];
        assertThat(background[3]).isEqualTo(255);
        for (const size of [120, 160, 100]) {
            const previousWidth = canvas.width;
            canvas.style.width = size + 'px';
            drawBlochScene(canvas, {x: 1, y: 0, z: 0}, 0.5, 0.2);
            assertThat([...ctx.getImageData(2, 2, 1, 1).data]).isEqualTo(background);
            assertThat(canvas.width).isEqualTo(previousWidth);
            await surface.render();
            assertThat(canvas.width).isEqualTo(Math.round(size * (window.devicePixelRatio || 1)));
        }
    } finally {
        await surface.destroy();
        canvas.remove();
    }
});

suite.test('a projection triangle is created only for an axis that gives the vector both legs', () => {
    const axes = vec => projectionTriangles(vec).map(t => t.axis);
    assertThat(axes({x: 1, y: 0, z: 0})).isEqualTo([]);
    assertThat(axes({x: 0, y: 0, z: -1})).isEqualTo([]);
    assertThat(axes({x: 0, y: 0, z: 0})).isEqualTo([]);
    assertThat(axes({x: 0.6, y: 0, z: 0.8})).isEqualTo(['x', 'z']);
    // The foot drops the triangle's own component and keeps the other two.
    assertThat(projectionTriangles({x: 0.5, y: -0.5, z: Math.SQRT1_2}).map(t => [t.axis, t.foot])).isEqualTo([
        ['x', [0, -0.5, Math.SQRT1_2]], ['y', [0.5, 0, Math.SQRT1_2]], ['z', [0.5, -0.5, 0]]]);
});

suite.test('coordinate-plane triangles have perpendicular component legs in every octant', () => {
    for (const x of [-0.3, 0.3]) for (const y of [-0.4, 0.4]) for (const z of [-0.5, 0.5]) {
        const triangles = coordinatePlaneTriangles({x, y, z});
        assertThat(triangles.map(t => t.axes.join('') + '⊥' + t.normal)).isEqualTo(['xy⊥z', 'xz⊥y', 'yz⊥x']);
        for (const {foot, tip} of triangles) {
            const leg = tip.map((v, i) => v - foot[i]);
            assertThat(foot.reduce((dot, v, i) => dot + v * leg[i], 0)).isEqualTo(0);
            assertTrue(Math.abs(Math.hypot(...foot) ** 2 + Math.hypot(...leg) ** 2 -
                Math.hypot(...tip) ** 2) < 1e-12);
        }
    }
    assertThat(coordinatePlaneTriangles({x: 0.5, y: -0.5, z: Math.SQRT1_2})[0]).isEqualTo(
        {axes: ['x', 'y'], normal: 'z', foot: [0.5, 0, 0], tip: [0.5, -0.5, 0]});
});

suite.test('a plane triangle needs only the two components in that plane', () => {
    for (const sign of [-1, 1]) {
        for (const [vec, axes] of [
            [{x: 0.6, y: sign * 0.8, z: 0}, ['x', 'y']],
            [{x: 0.6, y: 0, z: sign * 0.8}, ['x', 'z']],
            [{x: 0, y: 0.6, z: sign * 0.8}, ['y', 'z']],
        ]) {
            assertThat(coordinatePlaneTriangles(vec).map(t => t.axes)).isEqualTo([axes]);
        }
    }
    for (const vec of [{x: 0, y: 0, z: 0}, {x: 1, y: 0, z: 0}, {x: 0, y: 0, z: -1}]) {
        assertThat(coordinatePlaneTriangles(vec)).isEqualTo([]);
    }
});

suite.test('off the coordinate planes, plane and projection triangles have different corners', () => {
    const vec = {x: 0.5, y: 0.5, z: Math.SQRT1_2};
    const corners = t => JSON.stringify([t.foot, t.tip]);
    const projections = new Set(projectionTriangles(vec).map(t => corners({foot: t.foot, tip: [vec.x, vec.y, vec.z]})));
    for (const t of coordinatePlaneTriangles(vec)) assertTrue(!projections.has(corners(t)));
});

/** Whether p is inside the screen triangle abc, edges included. */
function inTriangle(p, [a, b, c]) {
    const side = (u, v) => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
    const d = [side(a, b), side(b, c), side(c, a)];
    return !(d.some(v => v < 0) && d.some(v => v > 0));
}

/** Every triangle the scene draws, as screen corners measured in sphere radii from its centre. */
function sceneTriangles(vec, yaw, pitch) {
    const screen = ([x, y, z]) => {
        const p = projectPoint(x, y, z, yaw, pitch);
        return {x: p.sx, y: -p.sy};
    };
    const origin = {x: 0, y: 0}, tip = screen([vec.x, vec.y, vec.z]);
    return [
        ...projectionTriangles(vec).map(t =>
            ({kind: 'projection', axis: t.axis, corners: [origin, screen(t.foot), tip]})),
        ...coordinatePlaneTriangles(vec).map(t =>
            ({kind: 'plane', axis: t.normal, corners: [origin, screen(t.foot), screen(t.tip)]})),
    ];
}

/**
 * The point inside the triangle and outside every other one that lies farthest from the centre:
 * there the triangle's own tint is the only one on the pixel, and the angle arcs and their labels,
 * which crowd the centre, are not. Undefined when the others cover this triangle entirely.
 */
function uncoveredPoint([origin, b, c], others) {
    let best;
    for (let u = 0.1; u <= 0.9; u += 0.05) {
        for (let v = 0.1; u + v <= 0.9; v += 0.05) {
            const p = {
                x: origin.x + u * (b.x - origin.x) + v * (c.x - origin.x),
                y: origin.y + u * (b.y - origin.y) + v * (c.y - origin.y),
            };
            if (others.some(t => inTriangle(p, t))) continue;
            if (best === undefined || Math.hypot(p.x, p.y) > Math.hypot(best.x, best.y)) best = p;
        }
    }
    return best;
}

/** The median of a small block around a point given in sphere radii, so a line cannot sway it. */
function sampler(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const half = canvas.clientWidth / 2, scale = canvas.clientWidth * 0.72 / 2;
    const context = canvas.getContext('2d');
    return p => {
        const data = context.getImageData(Math.round((half + p.x * scale) * dpr) - 2,
            Math.round((half + p.y * scale) * dpr) - 2, 5, 5).data;
        return [0, 1, 2].map(channel => {
            const values = [];
            for (let i = channel; i < data.length; i += 4) values.push(data[i]);
            return values.sort((a, b) => a - b)[(values.length - values.length % 2) / 2];
        });
    };
}

const rgbOf = color => [1, 3, 5].map(i => Number.parseInt(color.slice(i, i + 2), 16));
const rgbDistance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

/** A triangle of the given kind with room inside it that no other triangle covers. */
function readableTriangle(triangles, kind) {
    for (const triangle of triangles.filter(t => t.kind === kind)) {
        const point = uncoveredPoint(triangle.corners, triangles.filter(t => t !== triangle).map(t => t.corners));
        if (point !== undefined && Math.hypot(point.x, point.y) >= 0.55) return {triangle, point};
    }
    return undefined;
}

suite.test('every triangle tints its own inside in its own axis colour', async () => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '320px';
    canvas.style.height = '320px';
    document.body.appendChild(canvas);
    const surface = RenderSurface.forCanvas(canvas);
    try {
        // Seen from well above with the vector below the equator, no triangle covers another
        // entirely, so a projection triangle and a plane triangle can both be read off the pixels.
        const vec = {x: 0.7, y: 0.5, z: -0.3};
        const [yaw, pitch] = [-0.6, 0.9];
        drawBlochScene(canvas, vec, yaw, pitch);
        await surface.render();
        const sample = sampler(canvas);
        const sphere = rgbOf(CanvasTheme.bloch.background);
        // A triangle's inside is its own axis colour over the sphere's fill, at a projection
        // triangle's alpha or a plane triangle's fainter one.
        const tints = [];
        for (const [axis, color] of [['x', CanvasTheme.bloch.axisX], ['y', CanvasTheme.bloch.axisY],
            ['z', CanvasTheme.bloch.axisZ]]) {
            for (const alpha of [0.16, 0.1]) {
                tints.push({axis, rgb: rgbOf(color).map((v, i) => sphere[i] + alpha * (v - sphere[i]))});
            }
        }
        const triangles = sceneTriangles(vec, yaw, pitch);
        const checked = new Set();
        for (const triangle of triangles) {
            const others = triangles.filter(t => t !== triangle).map(t => t.corners);
            const point = uncoveredPoint(triangle.corners, others);
            if (point === undefined || Math.hypot(point.x, point.y) < 0.55) continue;
            const pixel = sample(point);
            const nearest = tints.reduce((best, tint) =>
                rgbDistance(pixel, tint.rgb) < rgbDistance(pixel, best.rgb) ? tint : best);
            assertThat(nearest.axis).
                withInfo({triangle: `${triangle.kind}:${triangle.axis}`, point, pixel}).
                isEqualTo(triangle.axis);
            checked.add(triangle.kind);
        }
        assertThat([...checked].sort()).isEqualTo(['plane', 'projection']);
    } finally {
        await surface.destroy();
        canvas.remove();
    }
});

suite.test('a layer that is switched off leaves the sphere, and reading one axis fades the rest', async () => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '320px';
    canvas.style.height = '320px';
    document.body.appendChild(canvas);
    const surface = RenderSurface.forCanvas(canvas);
    try {
        const vec = {x: 0.7, y: 0.5, z: -0.3};
        const [yaw, pitch] = [-0.6, 0.9];
        const found = readableTriangle(sceneTriangles(vec, yaw, pitch), 'projection');
        assertTrue(found !== undefined);
        const sample = sampler(canvas);
        const sphere = rgbOf(CanvasTheme.bloch.background);
        const other = ['x', 'y', 'z'].find(axis => axis !== found.triangle.axis);
        const draw = async options => {
            drawBlochScene(canvas, vec, yaw, pitch, options);
            await surface.render();
            return rgbDistance(sample(found.point), sphere);
        };

        const shown = await draw(undefined);
        assertTrue(shown > 8);
        // Switched off, the triangle is gone and its room is the sphere again.
        const hidden = await draw({layers: {circles: true, components: false, planes: false,
            angles: true, quaternion: false}});
        assertTrue(hidden < 3);
        // Reading another axis leaves this one drawn, but far fainter.
        const faded = await draw({focusAxis: other});
        assertTrue(faded < shown / 2);
        assertTrue(await draw({focusAxis: found.triangle.axis}) > shown * 0.9);
    } finally {
        await surface.destroy();
        canvas.remove();
    }
});

/** Every label a painted sphere holds, read off its committed scene. */
async function paintedTexts(size, vec) {
    const view = new DisplayView(document.createElement('canvas'));
    paintBlochScene(view, size, vec, Math.PI * -0.15, Math.PI * 0.11);
    await view.commit();
    const texts = [];
    const collect = node => {
        if (typeof node.text === 'string') texts.push(node.text);
        for (const child of node.children || []) collect(child);
    };
    collect(view);
    return texts;
}

suite.test('a thumbnail is glanced at: frame and vector only, no labels', async () => {
    assertThat(await paintedTexts(80, {x: 0.5, y: 0.5, z: Math.SQRT1_2})).isEqualTo([]);
    const full = await paintedTexts(320, {x: 0.5, y: 0.5, z: Math.SQRT1_2});
    for (const label of ['|0⟩', '|1⟩', 'x', 'y', 'z', 'θ 45.0°', 'ϕ 45.0°', 'cos θ']) {
        assertTrue(full.includes(label));
    }
});

suite.test('without a direction the sphere draws no angle and no formula (RULE A)', async () => {
    const texts = await paintedTexts(320, {x: 0, y: 0, z: 0});
    assertTrue(texts.includes('|0⟩'));
    assertTrue(!texts.some(t => t.includes('θ') || t.includes('ϕ')));
});

suite.test('on the z axis θ is still read, but no ϕ and no arc, since its plane is undefined (RULE B)', async () => {
    const texts = await paintedTexts(320, {x: 0, y: 0, z: -1});
    assertTrue(texts.includes('θ 180.0°'));
    assertTrue(!texts.some(t => t.includes('ϕ')));
    // The arcs' symbols stand alone on the sphere; without arcs there is no bare θ.
    assertTrue(!texts.includes('θ'));
});
