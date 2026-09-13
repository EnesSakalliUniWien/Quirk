import { useEffect } from "react";

/**
 * Shift+wheel scrolls the strip sideways. Plain wheels stay vertical, native horizontal gestures
 * stay horizontal, and operator zoom gestures belong to the operator.
 *
 * @param {!{current: (null|!HTMLElement)}} ref
 * @param {!boolean=} mounted Whether the element exists yet. A panel that first renders a
 *     placeholder mounts its scroller later, and the listener has to follow it there.
 */
function useWheelScrollsSideways(ref, mounted = true) {
  useEffect(() => {
    const scroller = ref.current;
    if (scroller === null) {
      return undefined;
    }
    const onWheel = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || !event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
        return;
      }
      const max = scroller.scrollWidth - scroller.clientWidth;
      const atStart = scroller.scrollLeft <= 0;
      const atEnd = scroller.scrollLeft >= max - 1;
      if (max <= 0 || (event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) {
        return;
      }
      scroller.scrollLeft = Math.max(0, Math.min(max, scroller.scrollLeft + event.deltaY));
      event.preventDefault();
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [ref, mounted]);
}

export { useWheelScrollsSideways };
