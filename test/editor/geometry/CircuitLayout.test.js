import {Suite, assertThat, assertThrows} from '../../TestUtil.js';
import {CircuitViewState} from '../../../src/editor/state/CircuitViewState.js';

const suite = new Suite('CircuitLayout');

suite.test('resizing the available area preserves earlier snapshots and only shifts outputs', () => {
    const original = CircuitViewState.empty(10);
    const geometry = original.geometry();
    const width = original.desiredWidth();
    const expanded = original.withAvailableWidth(width + 200);
    assertThat(expanded.desiredWidth()).isApproximatelyEqualTo(width + 200, 1);
    assertThat(expanded.gateRect(0, 0)).isEqualTo(original.gateRect(0, 0));
    assertThat(expanded.geometry().rectForSuperpositionDisplay().x - geometry.rectForSuperpositionDisplay().x).
        isApproximatelyEqualTo(200, 1);
    const shrunk = expanded.withAvailableWidth(width - 100);
    assertThat(shrunk.desiredWidth()).isEqualTo(width);
    assertThat(original.geometry() === geometry).isEqualTo(true);
    assertThat(expanded.geometry() === expanded.geometry()).isEqualTo(true);
    assertThat(original.desiredWidth()).isEqualTo(width);
    assertThat(expanded.geometry().displayShift > 0).isEqualTo(true);
});

suite.test('display updates isolate drag markers and invalidate derived layout', () => {
    const slot = {col: 0, row: 0, resizeStyle: false};
    const original = CircuitViewState.empty(10)._withHighlightedSlot(slot);
    const geometry = original.geometry();
    slot.row = 1;
    assertThat(original._highlightedSlot.row).isEqualTo(0);
    assertThrows(() => { original.top = 50; });
    const moved = original.withTop(50);
    assertThat(moved.geometry().wireRect(0).y - geometry.wireRect(0).y).isEqualTo(40);
    const compressed = original._withCompressedColumnIndex(0);
    assertThat(compressed.geometry().gateRect(0, 1).x < geometry.gateRect(0, 1).x).isEqualTo(true);
    assertThat(original.geometry() === geometry).isEqualTo(true);
    assertThat(original._withHighlightedSlot(undefined)._highlightedSlot).isEqualTo(undefined);
});
