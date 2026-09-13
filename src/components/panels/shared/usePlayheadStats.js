import { useEffect, useState } from "react";
import { useStore } from "zustand";

import { CooldownThrottle } from "../../../base/CooldownThrottle.js";
import { appStore } from "../../../state/appStore.js";

/** Milliseconds. Panels re-derive far slower than the canvas redraws, and nobody reads faster. */
const SAMPLE_COOLDOWN_MILLIS = 100;

/**
 * One of the simulator's outputs, sampled no faster than a panel can be read. The circuit redraws
 * every frame; re-deriving a table, a chart or a list of matrices that often would spend the whole
 * frame budget on something nobody can read that fast.
 *
 * @param {!function(!Object): !ObservableValue} pick Which of the panel dependencies to follow.
 * @returns {*} The latest sample, or undefined before the circuit has started.
 */
function useSampled(pick) {
  const deps = useStore(appStore, (s) => s.panelDeps);
  const [sample, setSample] = useState(undefined);

  useEffect(() => {
    if (deps === undefined) {
      return undefined;
    }
    let active = true;
    let latest = undefined;
    const throttle = new CooldownThrottle(() => {if (active) setSample(latest);}, SAMPLE_COOLDOWN_MILLIS);
    const unsubscribe = pick(deps).observable().subscribe((value) => {
      latest = value;
      throttle.trigger();
    });
    return () => {active = false; unsubscribe();};
    // pick is a module-level constant at every call site, so deps is the only real dependency.
  }, [deps]);

  return sample;
}

const pickCompleted = (deps) => deps.completed;

function useCompletedResult() {
  return useSampled(pickCompleted);
}

/**
 * The stats as far as the playhead has run, with the number of wires the circuit shows.
 *
 * @returns {undefined|!{stats: !CircuitStats, wireCount: !int}}
 */
function usePlayheadStats() {
  return useCompletedResult();
}

/**
 * The stats of the whole circuit, wherever the playhead is.
 *
 * @returns {undefined|!CircuitStats}
 */


export { usePlayheadStats, useCompletedResult };
