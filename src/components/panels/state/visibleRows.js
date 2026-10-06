/**
 * Which rows of a long table are worth having in the page: the ones in view, and a few more on
 * either side, so a quick scroll meets rows instead of blank space while the next range renders.
 * Every row has the same height, so the range follows from arithmetic and nothing here touches
 * the DOM.
 *
 * The rows left out are stood in for by two spacers, before the range and after it, so the table
 * keeps the height of all its rows and the scroll bar the size of the whole list.
 *
 * @param {!{
 *     scrollTop: !number,
 *     viewportHeight: !number,
 *     rowHeight: !number,
 *     rowCount: !int,
 *     overscan: !int
 * }} metrics scrollTop and viewportHeight are measured down the rows, from the top of the first.
 * @returns {!{start: !int, end: !int, before: !number, after: !number}} The rows from start up to,
 *     but not including, end, and the heights of the spacers that stand in for the rows either
 *     side of them.
 */
function visibleRowRange({
  scrollTop,
  viewportHeight,
  rowHeight,
  rowCount,
  overscan,
}) {
  if (!(rowHeight > 0) || !(rowCount > 0)) {
    return { start: 0, end: 0, before: 0, after: 0 };
  }
  const top = Math.max(0, scrollTop);
  const inView = Math.ceil(Math.max(0, viewportHeight) / rowHeight);
  // A list that has shrunk under a scroll position it no longer reaches shows its last rows, not none.
  const first = Math.min(
    Math.floor(top / rowHeight),
    Math.max(0, rowCount - inView),
  );
  const last = Math.ceil((top + Math.max(0, viewportHeight)) / rowHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(rowCount, last + overscan);
  return {
    start,
    end,
    before: start * rowHeight,
    after: (rowCount - end) * rowHeight,
  };
}

export { visibleRowRange };
