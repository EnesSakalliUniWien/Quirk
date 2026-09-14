import {EventBoundary} from 'pixi.js';
import {Suite, assertThat} from '../../TestUtil.js';
import {DisplayView} from '../scene/TestDisplayView.js';
import {paintMatrixTooltip} from '../../../src/draw/tooltips/MatrixTooltip.js';
import {Matrix} from '../../../src/engine/math/matrix/Matrix.js';
import {Rect} from '../../../src/geometry/Rect.js';
const suite = new Suite('MatrixTooltip');

suite.test('nativeRegionFitsOccupiedGridAndCellLookupPreservesRowOrder', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    const selected = [];
    const render = points => paintMatrixTooltip(view, Matrix.fromRows([[1, 2], [3, 4]]),
        new Rect(10, 10, 80, 40), points, (c, r) => `${c},${r}`,
        (c, r, value) => { selected.push([c, r, value.real]); return `${value.real}`; });
    render([{x: 31, y: 11}, {x: 11, y: 31}, {x: 50, y: 10}, {x: 9, y: 10}]);
    assertThat(selected).isEqualTo([[1, 0, 2], [0, 1, 3]]);
    await view.commit();
    const target = new EventBoundary(view.native).hitTest(11, 11);
    assertThat(target === view.children[0]).isEqualTo(true);
    assertThat(new EventBoundary(view.native).hitTest(70, 20) === target).isEqualTo(false);
    view.begin();
    render([]);
    await view.commit();
    assertThat(new EventBoundary(view.native).hitTest(11, 11) === target).isEqualTo(true);
    assertThat(view.tooltips.children.length).isEqualTo(0);
});
