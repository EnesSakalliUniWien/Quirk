import { useLayoutEffect, useState } from "react";

/**
 * How an element's text size compares with the document's, which a canvas's own units are made
 * for: 1 unless the element sits in chrome that follows the browser's text size, as the gate
 * details popup does. Read before the first paint, and again whenever the element resizes, which
 * chrome sized in em does when its text size changes.
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
    const size = (e) => Number.parseFloat(getComputedStyle(e).fontSize);
    const update = () => setScale(size(element) / size(element.ownerDocument.documentElement));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return enabled ? scale : 1;
}

export { useTextScale };
