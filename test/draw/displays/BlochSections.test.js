import {Suite, assertThat, assertTrue} from '../../TestUtil.js';
import {drawBlochSections, sectionProjections, sectionLayout} from '../../../src/draw/displays/BlochSections.js';
import {RenderSurface} from '../../../src/draw/surface/RenderSurface.js';
import {CanvasTheme} from '../../../src/config/CanvasTheme.js';

const suite = new Suite('BlochSections');

suite.test('a section keeps the two components the axis it looks down leaves behind', () => {
    const vec = {x: 0.5, y: -0.5, z: Math.SQRT1_2};
    assertThat(sectionProjections(vec).map(s => [s.axis, s.across, s.up, s.point])).isEqualTo([
        ['x', 'y', 'z', [-0.5, Math.SQRT1_2]],
        ['y', 'x', 'z', [0.5, Math.SQRT1_2]],
        ['z', 'x', 'y', [0.5, -0.5]]]);
    const equator = sectionProjections(vec)[2];
    assertThat(equator.length).isApproximatelyEqualTo(Math.hypot(0.5, 0.5));
    assertThat(equator.angle).isApproximatelyEqualTo(-Math.PI / 4);
    // A vector along an axis casts no shadow in the plane that axis is normal to.
    assertThat(sectionProjections({x: 1, y: 0, z: 0})[0].length).isEqualTo(0);
});

suite.test('the shadow is drawn where its section says it falls', async () => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '480px';
    canvas.style.height = '160px';
    document.body.appendChild(canvas);
    const surface = RenderSurface.forCanvas(canvas);
    try {
        const vec = {x: 0.5, y: -0.5, z: Math.SQRT1_2};
        drawBlochSections(canvas, vec);
        await surface.render();
        const dpr = window.devicePixelRatio || 1;
        const {cell, radius, centerY} = sectionLayout(480, 160);
        const context = canvas.getContext('2d');
        const pixel = (index, a, u) => [...context.getImageData(
            Math.round((cell * (index + 0.5) + a * radius) * dpr),
            Math.round((centerY - u * radius) * dpr), 1, 1).data].slice(0, 3);
        const rgbOf = color => [1, 3, 5].map(i => Number.parseInt(color.slice(i, i + 2), 16));
        const distance = (p, q) => Math.hypot(...p.map((v, i) => v - q[i]));
        const vector = rgbOf(CanvasTheme.bloch.vector), sphere = rgbOf(CanvasTheme.bloch.background);
        for (const [index, {point: [a, u]}] of sectionProjections(vec).entries()) {
            // The marker sits on the shadow, and its mirror image is untouched sphere.
            assertTrue(distance(pixel(index, a, u), vector) < 40);
            assertTrue(distance(pixel(index, -a, -u), sphere) < 40);
        }
    } finally {
        await surface.destroy();
        canvas.remove();
    }
});

suite.test('reading one axis fades the other sections', async () => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '480px';
    canvas.style.height = '160px';
    document.body.appendChild(canvas);
    const surface = RenderSurface.forCanvas(canvas);
    try {
        const vec = {x: 0.5, y: -0.5, z: Math.SQRT1_2};
        drawBlochSections(canvas, vec, {focusAxis: 'z'});
        await surface.render();
        const dpr = window.devicePixelRatio || 1;
        const {cell, radius, centerY} = sectionLayout(480, 160);
        const context = canvas.getContext('2d');
        const marker = index => {
            const [a, u] = sectionProjections(vec)[index].point;
            return [...context.getImageData(Math.round((cell * (index + 0.5) + a * radius) * dpr),
                Math.round((centerY - u * radius) * dpr), 1, 1).data].slice(0, 3);
        };
        const green = marker(2)[1], faded = marker(0)[1];
        assertTrue(green > 150);
        assertTrue(faded < green / 2);
    } finally {
        await surface.destroy();
        canvas.remove();
    }
});
