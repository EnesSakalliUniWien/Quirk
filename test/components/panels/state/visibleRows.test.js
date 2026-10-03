import {Suite, assertThat} from '../../../TestUtil.js';
import {visibleRowRange} from '../../../../src/components/panels/state/visibleRows.js';

const suite = new Suite('visibleRows');

const range = (scrollTop, {viewportHeight = 100, rowHeight = 10, rowCount = 1000, overscan = 3} = {}) =>
    visibleRowRange({scrollTop, viewportHeight, rowHeight, rowCount, overscan});

suite.test('at the top, the rows in view and the overscan below them are rendered', () => {
    // Ten rows fill the viewport; three more below, and nothing above the first.
    assertThat(range(0)).isEqualTo({start: 0, end: 13, before: 0, after: 9870});
});

suite.test('scrolled down, the overscan comes either side of the rows in view', () => {
    // Row 50 is the first in view; rows 50 to 59 are in view.
    assertThat(range(500)).isEqualTo({start: 47, end: 63, before: 470, after: 9370});
});

suite.test('a row only partly in view is rendered', () => {
    // Scrolled four pixels into row 50, whose top is hidden, the viewport reaches four pixels into row 60.
    assertThat(range(504)).isEqualTo({start: 47, end: 64, before: 470, after: 9360});
});

suite.test('at the bottom, the rows stop at the last one and no spacer follows', () => {
    // 1000 rows of 10 is 10000 pixels, scrolled to the end of the viewport at 9900.
    assertThat(range(9900)).isEqualTo({start: 987, end: 1000, before: 9870, after: 0});
});

suite.test('the spacers and the rendered rows are as tall as every row together', () => {
    for (const rowHeight of [10, 27.1875, 28, 33.5]) {
        for (const rowCount of [0, 1, 7, 40, 4096]) {
            for (const scrollTop of [0, 1, 99.5, 1234, rowCount * rowHeight, rowCount * rowHeight * 2]) {
                const {start, end, before, after} = range(scrollTop, {rowHeight, rowCount, viewportHeight: 480});
                assertThat(before + (end - start) * rowHeight + after).
                    withInfo({rowHeight, rowCount, scrollTop}).
                    isApproximatelyEqualTo(rowCount * rowHeight);
                assertThat(start >= 0 && start <= end && end <= rowCount).
                    withInfo({rowHeight, rowCount, scrollTop, start, end}).
                    isEqualTo(true);
            }
        }
    }
});

suite.test('a list that fits renders every row, with no spacers', () => {
    assertThat(range(0, {rowCount: 12})).isEqualTo({start: 0, end: 12, before: 0, after: 0});
    assertThat(range(0, {rowCount: 1})).isEqualTo({start: 0, end: 1, before: 0, after: 0});
});

suite.test('a list that shrank under its scroll position shows its last rows, not none', () => {
    // Scrolled to row 500 of a list that is now 40 rows long: the container will clamp it to the end.
    assertThat(range(5000, {rowCount: 40})).isEqualTo({start: 27, end: 40, before: 270, after: 0});
});

suite.test('rows are found by arithmetic on a height that is not a whole number of pixels', () => {
    // The browser's row height is what it measures, here 27 and 3/16 pixels.
    const rowHeight = 27.1875;
    const {start, end, before, after} = range(rowHeight * 100, {rowHeight, viewportHeight: rowHeight * 10});
    assertThat([start, end]).isEqualTo([97, 113]);
    assertThat(before).isEqualTo(97 * rowHeight);
    assertThat(after).isEqualTo(887 * rowHeight);
});

suite.test('before the container has a height, only the overscan is rendered', () => {
    assertThat(range(0, {viewportHeight: 0})).isEqualTo({start: 0, end: 3, before: 0, after: 9970});
});

suite.test('there is nothing to render without rows or a row height', () => {
    const none = {start: 0, end: 0, before: 0, after: 0};
    assertThat(range(0, {rowCount: 0})).isEqualTo(none);
    assertThat(range(0, {rowHeight: 0})).isEqualTo(none);
    assertThat(range(0, {rowHeight: NaN})).isEqualTo(none);
});
