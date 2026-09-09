import { useEffect, useState } from "react";

/**
 * Reads a src/base/Obs.js observable as React state.
 *
 * @param {!Observable.<*>} observable
 * @returns {*} The observable's latest value; Quirk observables emit their current value on
 *     subscribe, so the initial render already has one.
 */
function useObservedValue(observable) {
  const [value, setValue] = useState(() => {
    // Seed synchronously: the effect's subscription would leave the first paint empty.
    let initial = undefined;
    observable.subscribe((latest) => {
      initial = latest;
    })();
    return initial;
  });
  useEffect(() => observable.subscribe(setValue), [observable]);
  return value;
}

export { useObservedValue };
