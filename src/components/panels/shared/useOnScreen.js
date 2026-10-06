import { useEffect, useState } from "react";

import { usePanelVisibility } from "./usePanelVisibility.js";

/** What to call, for each element watched, when it comes into view or leaves it. */
const watchers = new Map();
let observer;

/**
 * One observer for every element watched: a card per step, two canvases each, is hundreds of
 * elements that all want the same answer.
 *
 * @param {!Element} element
 * @param {!function(!boolean): void} onChange Told whether the element is in view, once at the start
 *     and again whenever that changes.
 * @returns {!function(): void} Stops watching.
 */
function watch(element, onChange) {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      watchers.get(entry.target)?.(entry.isIntersecting);
    }
  });
  watchers.set(element, onChange);
  observer.observe(element);
  return () => {
    watchers.delete(element);
    observer.unobserve(element);
  };
}

/**
 * Whether an element can be seen: inside the page's viewport and the clip of every scroller around
 * it, and in a dock panel that is showing. A panel that paints for the eye - a canvas the shared
 * renderer copies its pixels into, which costs the GPU a copy for each paint - has no use for a
 * painting that nobody sees, and one that waits for this paints once, when it comes into view.
 *
 * The first answer is "no", for as long as it takes the browser to say: a canvas that is on screen
 * is painted a frame late, and one that is not is never painted at all. Where there is no
 * IntersectionObserver every element counts as in view.
 *
 * @param {!{current: (null|!Element)}} ref The element to watch, once it is mounted.
 * @returns {!boolean}
 */
function useOnScreen(ref) {
  const panelShowing = usePanelVisibility();
  const observable = typeof IntersectionObserver !== "undefined";
  const [inView, setInView] = useState(!observable);
  useEffect(() => {
    const element = ref.current;
    return observable && element !== null
      ? watch(element, setInView)
      : undefined;
  }, [ref, observable]);
  return panelShowing && inView;
}

export { useOnScreen };
