import {Suite, assertThat} from '../../../TestUtil.js';
import {DisplayView} from '../../../draw/scene/TestDisplayView.js';
import {drawOutputSuperpositionDisplay_labels, invalidateCircuitLabelCache} from '../../../../src/editor/rendering/outputs/CircuitBasisLabels.js';
import {invalidateTextLayout} from '../../../../src/draw/text/TextLayout.js';
import {CircuitGeometry} from '../../../../src/editor/geometry/CircuitGeometry.js';
import {CircuitDefinition} from '../../../../src/circuit/model/CircuitDefinition.js';
import {SUPERPOSITION_GRID_LABEL_SPAN} from '../../../../src/editor/geometry/CircuitLayoutConstants.js';
import {labelsIn} from '../RenderingTestUtil.js';

const suite = new Suite('CircuitBasisLabels');

suite.test('basis labels preserve bit ordering and fit their row and column strips', async () => {
    for (const wires of [2, 3, 6, 16]) {
        const geometry = new CircuitGeometry(0, new CircuitDefinition(wires, []), undefined, undefined, 0);
        const grid = geometry.rectForSuperpositionDisplay();
        const view = new DisplayView(document.createElement('canvas'));
        drawOutputSuperpositionDisplay_labels({geometry}, view);
        await view.commit();
        const labels = labelsIn(view);
        const rows = labels.filter(label => label.text.endsWith('⋯')).sort((a,b) => a.getBounds().y - b.getBounds().y);
        const cols = labels.filter(label => label.text.startsWith('⋯')).sort((a,b) => a.getBounds().x - b.getBounds().x);
        const rowBits = Math.ceil(geometry.importantWireCount() / 2);
        const colBits = Math.floor(geometry.importantWireCount() / 2);
        assertThat(rows.map(label => label.text)).isEqualTo(Array.from({length: 2 ** rowBits}, (_,i) => i.toString(2).padStart(rowBits, '0') + '⋯'));
        assertThat(cols.map(label => label.text)).isEqualTo(Array.from({length: 2 ** colBits}, (_,i) => '⋯' + i.toString(2).padStart(colBits, '0')));
        for (const label of rows) {
            const b = label.getBounds();
            assertThat(b.x >= grid.right() - 0.01 && b.maxX <= grid.right() + SUPERPOSITION_GRID_LABEL_SPAN + 0.01 &&
                b.y >= grid.y - 0.01 && b.maxY <= grid.bottom() + 0.01).withInfo({wires, text:label.text, bounds:b}).isEqualTo(true);
        }
        for (const label of cols) {
            const b = label.getBounds();
            assertThat(b.x >= grid.x - 0.01 && b.maxX <= grid.right() + 0.01 &&
                b.y >= grid.bottom() - 0.01 && b.maxY <= grid.bottom() + SUPERPOSITION_GRID_LABEL_SPAN + 0.01).withInfo({wires, text:label.text, bounds:b}).isEqualTo(true);
        }
    }
});

suite.test('retained labels follow placement, font invalidation, resolution and wire count changes', async () => {
    const view = new DisplayView(document.createElement('canvas'));
    const geometry = new CircuitGeometry(0, new CircuitDefinition(4, []), undefined, undefined, 0);
    const update = async (g = geometry, ratio = 1) => {
        view.begin(undefined, ratio);
        drawOutputSuperpositionDisplay_labels({geometry:g}, view);
        await view.commit();
        return labelsIn(view);
    };
    const before = await update();
    const x = before[0].getBounds().x;
    const moved = new CircuitGeometry(0, geometry.circuitDefinition, undefined, undefined, 20);
    const after = await update(moved);
    assertThat(after.every((label,i) => label === before[i])).isEqualTo(true);
    assertThat(after[0].getBounds().x - x).isApproximatelyEqualTo(20);
    invalidateTextLayout();
    invalidateCircuitLabelCache();
    const refreshed = await update(moved, 2);
    assertThat(refreshed.map(label => label.text)).isEqualTo(before.map(label => label.text));
    assertThat(refreshed.every(label => label.resolution === 2)).isEqualTo(true);
    const smaller = await update(new CircuitGeometry(0, new CircuitDefinition(2, []), undefined, undefined, 0));
    assertThat(smaller.map(label => label.text).sort()).isEqualTo(['0⋯','1⋯','⋯0','⋯1'].sort());
});
