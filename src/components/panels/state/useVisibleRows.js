import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { visibleRowRange } from "./visibleRows.js";

/** The row height until one has been measured: the stylesheet's 1.75rem at a 16px root. */
const DEFAULT_ROW_HEIGHT = 28;

/** Rows kept either side of the ones in view. */
const OVERSCAN = 8;

/**
 * The height of one row, from the distance between the first two rendered ones. The stylesheet
 * gives every row the same height, but only the browser knows what that is in pixels, and it is
 * seldom a whole number. A rendered row is one with an aria-rowindex; spacers have none.
 *
 * @param {!HTMLElement} scroll
 * @returns {undefined|!number} Undefined while fewer than two rows are rendered or the table is hidden.
 */
function measuredRowHeight(scroll) {
  const [first, second] = scroll.querySelectorAll("tbody > tr[aria-rowindex]");
  const height = second === undefined ? 0 : second.getBoundingClientRect().top - first.getBoundingClientRect().top;
  return height > 0 ? height : undefined;
}

/**
 * Which rows of a long table to render, following the scroll container that holds it.
 *
 * Only the first row in view and the container's height are state, so scrolling renders again when
 * a row boundary goes by, not on every pixel. The row height is measured again whenever the
 * container is resized, which is also when a panel that was hidden is shown.
 *
 * @param {!int} rowCount
 * @returns {!{
 *     scrollRef: !{current: (null|!HTMLElement)},
 *     start: !int,
 *     end: !int,
 *     before: !number,
 *     after: !number
 * }} Put scrollRef on the scroll container; see visibleRowRange for the rest.
 */
function useVisibleRows(rowCount) {
  const scrollRef = useRef(/** @type {null|!HTMLElement} */ (null));
  const [view, setView] = useState({ firstRow: 0, viewportHeight: 0, rowHeight: DEFAULT_ROW_HEIGHT });

  // Again whenever the number of rows changes, before the first paint of the new rows: a table that
  // has just got its rows is taller than the empty one the container was last measured around.
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const read = (measure) => {
      const measured = measure ? measuredRowHeight(scroll) : undefined;
      const { scrollTop, clientHeight } = scroll;
      setView((previous) => {
        const rowHeight = measured ?? previous.rowHeight;
        const firstRow = Math.floor(scrollTop / rowHeight);
        return previous.firstRow === firstRow &&
          previous.viewportHeight === clientHeight &&
          previous.rowHeight === rowHeight
          ? previous
          : { firstRow, viewportHeight: clientHeight, rowHeight };
      });
    };
    const onScroll = () => read(false);
    const onResize = () => read(true);
    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(scroll);
    scroll.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      scroll.removeEventListener("scroll", onScroll);
    };
  }, [rowCount]);

  const range = useMemo(
    () =>
      visibleRowRange({
        scrollTop: view.firstRow * view.rowHeight,
        viewportHeight: view.viewportHeight,
        rowHeight: view.rowHeight,
        rowCount,
        overscan: OVERSCAN,
      }),
    [view, rowCount],
  );
  return { scrollRef, ...range };
}

export { useVisibleRows };
