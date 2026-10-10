import { useLayoutEffect, useState } from "react";

import { Typography } from "../appearance/typography.js";

/**
 * How an element's text size compares with the size the app is designed at, which a canvas's own
 * units are made for. The document root follows the browser's text size, and so does chrome sized
 * from it, as the gate details popup is. Read before the first paint, and again whenever the
 * element resizes, which chrome sized in rem does when the text size changes.
 *
 * @param {!{current: (null|!Element)}} ref
 * @param {!boolean} enabled False keeps the scale at 1 without watching the element.
 * @returns {!number}
 */
function useTextScale(ref, enabled) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    const update = () =>
      setScale(
        Number.parseFloat(getComputedStyle(element).fontSize) /
          Typography.size.root,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return enabled ? scale : 1;
}

export { useTextScale };
