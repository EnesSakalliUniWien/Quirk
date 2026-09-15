import {Suite, assertThat, assertTrue} from '../../TestUtil.js';
import {drawBlochProjection, projectionGeometry} from '../../../src/draw/displays/BlochProjections.js';
import {drawBlochScene} from '../../../src/draw/displays/BlochScene.js';
import {unitCircleOf} from '../../../src/draw/displays/BlochGeometry.js';
import {RenderSurface} from '../../../src/draw/surface/RenderSurface.js';
import {CanvasTheme} from '../../../src/config/CanvasTheme.js';

const suite = new Suite('BlochProjections');

suite.test('unavailable projections are distinct from maximally mixed states', async () => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '320px';
    canvas.style.height = '320px';
    document.body.appendChild(canvas);
    const surface = RenderSurface.forCanvas(canvas);
    try {
        for (const plane of ['meridian', 'equator']) {
            for (const vec of [undefined, {x: 0, y: 0, z: 0}]) {
                drawBlochProjection(canvas, vec, plane);
                await surface.render();
                const texts = [];
                const collect = node => {
                    if (typeof node.text === 'string') texts.push(node.text);
                    for (const child of node.children || []) collect(child);
                };
                collect(surface.app.stage);
                assertThat(texts.includes('State unavailable')).isEqualTo(vec === undefined);
                assertThat(texts.includes('Maximally mixed — no Bloch direction defined')).isEqualTo(vec !== undefined);
            }
        }
    } finally {
        await surface.destroy();
        canvas.remove();
    }
});

suite.test('projection angles, components and circles can each be hidden', async () => {
    for (const plane of ['meridian', 'equator']) {
        const canvas = document.createElement('canvas');
        canvas.style.width = '320px';
        canvas.style.height = '320px';
        document.body.appendChild(canvas);
        const surface = RenderSurface.forCanvas(canvas);
        const vec = {x: 0.5, y: 0.5, z: Math.SQRT1_2};
        try {
            const shown = {angles: true, components: true, circles: true, trig: false};
            drawBlochProjection(canvas, vec, plane, {layers: shown});
            await surface.render();
            const all = canvas.toDataURL();
            for (const layer of ['angles', 'components', 'circles']) {
                drawBlochProjection(canvas, vec, plane, {layers: {...shown, [layer]: false}});
                await surface.render();
                assertTrue(canvas.toDataURL() !== all, `${plane}: hiding ${layer} must change the figure`);
            }
        } finally {
            await surface.destroy();
            canvas.remove();
        }
    }
});

suite.test('the meridian holds θ itself, and the equator ϕ', () => {
    const vec = {x: 0.5, y: 0.5, z: Math.SQRT1_2};
    const meridian = projectionGeometry(vec, 'meridian');
    assertThat(meridian.across.letter).isEqualTo('ρ');
    assertThat(meridian.point).isApproximatelyEqualTo([Math.SQRT1_2, Math.SQRT1_2]);
    assertThat(meridian.length).isApproximatelyEqualTo(1);
    assertThat(meridian.arc.label).isEqualTo('θ 45.0°');
    // The arc turns from +z down to the vector, which lies at π/2 − θ in the plane.
    assertThat(meridian.arc.to).isApproximatelyEqualTo(Math.atan2(meridian.point[1], meridian.point[0]));

    const equator = projectionGeometry(vec, 'equator');
    assertThat(equator.point).isApproximatelyEqualTo([0.5, 0.5]);
    assertThat(equator.length).isApproximatelyEqualTo(Math.SQRT1_2);
    assertThat(equator.arc.label).isEqualTo('ϕ 45.0°');
    assertThat(equator.formulas).isEqualTo([['x', 'sin θ cos ϕ'], ['y', 'sin θ sin ϕ']]);
    assertThat(equator.note).isEqualTo(undefined);
});

suite.test('|+⟩ lies on the x axis of both sections', () => {
    const meridian = projectionGeometry({x: 1, y: 0, z: 0}, 'meridian');
    assertThat(meridian.point).isApproximatelyEqualTo([1, 0]);
    assertThat(meridian.arc.label).isEqualTo('θ 90.0°');
    const equator = projectionGeometry({x: 1, y: 0, z: 0}, 'equator');
    assertThat(equator.arc.label).isEqualTo('ϕ 0.0°');
});

suite.test('without a direction neither section has an angle or a formula (RULE A)', () => {
    for (const plane of ['meridian', 'equator']) {
        const geometry = projectionGeometry({x: 0, y: 0, z: 0}, plane);
        assertThat(geometry.arc).isEqualTo(undefined);
        assertTrue(geometry.formulas.every(([, formula]) => formula === undefined));
        assertThat(geometry.note).isEqualTo('Maximally mixed — no Bloch direction defined');
    }
});

suite.test('on the z axis the meridian is the XZ plane and the equator has no ϕ (RULE B)', () => {
    const meridian = projectionGeometry({x: 0, y: 0, z: -1}, 'meridian');
    assertThat(meridian.across.letter).isEqualTo('x');
    assertThat(meridian.point).isApproximatelyEqualTo([0, -1]);
    assertThat(meridian.arc.label).isEqualTo('θ 180.0°');
    assertThat(meridian.formulas).isEqualTo([['x', undefined], ['z', 'cos θ']]);

    const equator = projectionGeometry({x: 0, y: 0, z: -1}, 'equator');
    assertThat(equator.arc).isEqualTo(undefined);
    assertThat(equator.formulas).isEqualTo([['x', undefined], ['y', undefined]]);
    assertThat(equator.note).isEqualTo('ϕ undefined — vector lies on z-axis');
});

suite.test('the arrow ends where the geometry says the shadow falls', async () => {
    for (const plane of ['meridian', 'equator']) {
        const canvas = document.createElement('canvas');
        canvas.style.width = '240px';
        canvas.style.height = '240px';
        document.body.appendChild(canvas);
        const surface = RenderSurface.forCanvas(canvas);
        try {
            const vec = {x: 0.6, y: -0.3, z: 0.5};
            drawBlochProjection(canvas, vec, plane);
            await surface.render();
            const dpr = window.devicePixelRatio || 1;
            const {cx, cy, radius} = unitCircleOf(240);
            const [a, u] = projectionGeometry(vec, plane).point;
            // Two thirds of the way out the shaft is drawn, and nothing but the shaft.
            const x = cx + a * radius * 0.66, y = cy - u * radius * 0.66;
            const pixel = [...canvas.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data];
            const green = [1, 3, 5].map(i => Number.parseInt(CanvasTheme.bloch.vector.slice(i, i + 2), 16));
            assertTrue(Math.hypot(pixel[0] - green[0], pixel[1] - green[1], pixel[2] - green[2]) < 60);
        } finally {
            await surface.destroy();
            canvas.remove();
        }
    }
});

const rgbOf = color => [1, 3, 5].map(i => Number.parseInt(color.slice(i, i + 2), 16));
const rgbDistance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

/**
 * How far from the unit circle's centre, as unitCircleOf places it for the canvas's width, the
 * circle's fill ends along both diagonals, where no axis, tick or label is drawn. Each pixel is the
 * median of a small block, so a grid line crossing the diagonal cannot sway it.
 */
function diagonalEdges(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const {cx, cy, radius} = unitCircleOf(canvas.clientWidth);
    const context = canvas.getContext('2d');
    const inside = rgbOf(CanvasTheme.bloch.background), outside = rgbOf(CanvasTheme.surface.background);
    const median = (x, y) => {
        const data = context.getImageData(Math.round(x * dpr) - 2, Math.round(y * dpr) - 2, 5, 5).data;
        return [0, 1, 2].map(channel => {
            const values = [];
            for (let i = channel; i < data.length; i += 4) values.push(data[i]);
            return values.sort((a, b) => a - b)[(values.length - values.length % 2) / 2];
        });
    };
    return [Math.PI / 4, Math.PI * 5 / 4].map(angle => {
        for (let r = radius * 0.8; r < radius * 1.2; r += 0.5) {
            const pixel = median(cx + Math.cos(angle) * r, cy - Math.sin(angle) * r);
            if (rgbDistance(pixel, outside) < rgbDistance(pixel, inside)) return r;
        }
        return Infinity;
    });
}

suite.test('the sphere and both sections draw one unit circle, at one size and one height', async () => {
    const width = 240;
    const figures = [
        [width, canvas => drawBlochScene(canvas, undefined, 0, 0)],
        [width, canvas => drawBlochProjection(canvas, undefined, 'meridian')],
        [width, canvas => drawBlochProjection(canvas, undefined, 'equator')],
    ];
    const {radius} = unitCircleOf(width);
    for (const [height, draw] of figures) {
        const canvas = document.createElement('canvas');
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        document.body.appendChild(canvas);
        const surface = RenderSurface.forCanvas(canvas);
        try {
            draw(canvas);
            await surface.render();
            // Both diagonals end at the one radius: the circle is that size, and centred where
            // every figure of this width centres it.
            assertThat(diagonalEdges(canvas)).withInfo({height}).isApproximatelyEqualTo([radius, radius], 1.5);
        } finally {
            await surface.destroy();
            canvas.remove();
        }
    }
});
