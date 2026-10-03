import {Suite, assertThat} from '../../../TestUtil.js';
import {DisplayView} from '../../scene/TestDisplayView.js';
import {Color} from 'pixi.js';
import {CanvasTheme, phaseTint} from '../../../../src/config/CanvasTheme.js';
import {labelsIn} from '../../../editor/rendering/RenderingTestUtil.js';
import {Matrix} from '../../../../src/engine/math/matrix/Matrix.js';
import {Rect} from '../../../../src/geometry/Rect.js';
import {paintDensityMatrix, densityGridRect} from '../../../../src/draw/displays/density/DensityMatrixView.js';

const suite = new Suite('DensityRendering');
suite.test('rectangular density displays share occupied bounds and retain unchanged geometry', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    const matrix = Matrix.fromRows([[0.5, 0.5], [0.5, 0.5]]);
    const area = new Rect(10, 20, 140, 180);
    const grid = densityGridRect(matrix, area);
    assertThat(grid.w).isEqualTo(grid.h);
    const draw = async () => {view.begin();paintDensityMatrix(view, matrix, area);await view.commit();};
    await draw();
    const cells = view.children.find(child => child.kinds !== undefined);
    const ground = cells.ground.context.instructions.slice();
    const bounds = cells.getLocalBounds();
    assertThat(Math.abs(bounds.width-bounds.height) < 0.01).isEqualTo(true);
    const region = view.children.find(child => child.hitArea);
    assertThat([region.hitArea.x,region.hitArea.y,region.hitArea.width,region.hitArea.height]).
        isEqualTo([grid.x,grid.y,grid.w,grid.h]);
    const disc = cells.kinds[0][0];
    const size = disc.scaleX;
    await draw();
    assertThat(disc.scaleX).isEqualTo(size);
    // A changed entry resizes its disc; the ground and lines it stands on are not drawn again.
    matrix.rawBuffer()[0] = 0.25;
    await draw();
    assertThat(cells.kinds[0][0] === disc && disc.scaleX < size).isEqualTo(true);
    assertThat(cells.ground.context.instructions.every((instruction, i) => instruction === ground[i])).isEqualTo(true);
});

suite.test('dense density values are one texture of pixels, without lines between them', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    paintDensityMatrix(view, Matrix.generate(64,64,()=>1/64), new Rect(0,0,240,240));
    await view.commit();
    const cells = view.children.find(child => child.kinds !== undefined);
    assertThat(cells.ground.context.instructions.some(instruction => instruction.action === 'stroke')).isEqualTo(false);
    assertThat([cells.pixelSprite?.visible, cells.marks.visible]).isEqualTo([true, false]);
});

suite.test('five-qubit density retains cell geometry even below the old pixel-size cutoff', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    paintDensityMatrix(view, Matrix.identity(32).times(1/32), new Rect(0,0,240,240));
    await view.commit();
    const cells = view.children.find(child => child.kinds !== undefined);
    assertThat(cells.ground.context.instructions.some(instruction=>instruction.action==='stroke')).isEqualTo(true);
    assertThat(cells.marks.visible).isEqualTo(true);
});

suite.test('a two-qubit density display names every row and column', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    paintDensityMatrix(view, Matrix.identity(4).times(1/4), new Rect(0, 0, 120, 152));
    await view.commit();
    const texts = labelsIn(view).map(label => label.text);
    for (const basis of ['00', '01', '10', '11']) {
        assertThat(texts.filter(text => text === basis).length).withInfo({basis, texts}).isEqualTo(2);
    }
});

suite.test('dense density displays outline their diagonal and key their phase colours with a wheel', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    paintDensityMatrix(view, Matrix.generate(64, 64, () => 1/64), new Rect(0, 0, 240, 240));
    await view.commit();
    const guide = new Color(CanvasTheme.stroke.guide).toNumber();
    const values = view.children.find(child => child.kinds !== undefined);
    assertThat(view.children.some(child => child !== values && (child.context?.instructions ?? []).some(i =>
        i.action === 'stroke' && i.data.style.color === guide))).isEqualTo(true);
    const texts = labelsIn(view).map(label => label.text);
    assertThat(texts.includes('colour = phase')).withInfo({texts}).isEqualTo(true);
    // The wheel beside the words: wedges of the phase colours, a quarter turn apart blue, magenta, orange, green.
    const fills = new Set(view.children.flatMap(child => (child.context?.instructions ?? []).
        filter(i => i.action === 'fill').map(i => i.data.style.color)));
    for (const degrees of [0, 90, 180, -90]) {
        assertThat([...fills].some(color => near(color, phaseTint(degrees)))).withInfo({degrees}).isEqualTo(true);
    }
});

/** Whether two 0xRRGGBB colours are within a few levels in each channel, as wedge and tint round apart. */
function near(a, b) {
    return [16, 8, 0].every(shift => Math.abs(((a >> shift) & 255) - ((b >> shift) & 255)) <= 6);
}
