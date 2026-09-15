import {Suite, assertThat} from '../../../TestUtil.js';
import {DisplayView} from '../../scene/TestDisplayView.js';
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
    const graphic = view.children.find(child => child.picture !== undefined || child.previous !== undefined);
    const first = graphic.context.instructions[0];
    const bounds = graphic.getLocalBounds();
    assertThat(Math.abs(bounds.width-bounds.height) < 0.01).isEqualTo(true);
    const region = view.children.find(child => child.hitArea);
    assertThat([region.hitArea.x,region.hitArea.y,region.hitArea.width,region.hitArea.height]).
        isEqualTo([grid.x,grid.y,grid.w,grid.h]);
    await draw();
    assertThat(graphic.context.instructions[0] === first).isEqualTo(true);
    matrix.rawBuffer()[0] = 0.25;
    await draw();
    assertThat(graphic.context.instructions[0] === first).isEqualTo(false);
});

suite.test('dense density values use filled pixels without overlapping strokes', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    paintDensityMatrix(view, Matrix.generate(64,64,()=>1/64), new Rect(0,0,240,240));
    await view.commit();
    const graphic = view.children.find(child => child.previous !== undefined);
    assertThat(graphic.context.instructions.some(instruction => instruction.action === 'stroke')).isEqualTo(false);
    assertThat(graphic.context.instructions.length > 1).isEqualTo(true);
});

suite.test('five-qubit density retains cell geometry even below the old pixel-size cutoff', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    paintDensityMatrix(view, Matrix.identity(32).times(1/32), new Rect(0,0,240,240));
    await view.commit();
    const graphic = view.children.find(child=>child.previous !== undefined);
    assertThat(graphic.context.instructions.some(instruction=>instruction.action==='stroke')).isEqualTo(true);
});
