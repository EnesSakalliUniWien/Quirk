import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { CooldownThrottle } from "../../../base/CooldownThrottle.js";
import { appStore } from "../../../state/appStore.js";
import { usePanelVisibility } from "./usePanelVisibility.js";

/** Milliseconds. Panels re-derive far slower than the canvas redraws, and nobody reads faster. */
const SAMPLE_COOLDOWN_MILLIS = 100;

/**
 * One of the simulator's outputs, sampled no faster than a panel can be read. The circuit redraws
 * every frame; re-deriving a table, a chart or a list of matrices that often would spend the whole
 * frame budget on something nobody can read that fast.
 *
 * A panel behind another tab of its group stays mounted, and nobody reads it at all: it keeps the
 * sample it has until it is shown again, and then takes the newest one at once. A time-dependent
 * gate has the simulator publishing every frame, and the algebra panel's re-derivation alone would
 * otherwise hold the whole app at a few frames a second from behind its tab.
 *
 * @param {!function(!Object): import("zustand/vanilla").StoreApi} pick Which of the panel dependencies to follow.
 * @returns {*} The latest sample, or undefined before the circuit has started.
 */
function useSampled(pick) {
  const deps = useStore(appStore, (s) => s.panelDeps);
  const visible = usePanelVisibility();
  const [sample, setSample] = useState(undefined);
  const visibleRef = useRef(visible);
  const shownRef = useRef(/** @type {undefined|(() => void)} */ (undefined));

  useEffect(() => {
    if (deps === undefined) {
      return undefined;
    }
    let active = true;
    let latest = undefined;
    let missed = false;
    const deliver = () => {
      if (!active) return;
      if (!visibleRef.current) {
        missed = true;
        return;
      }
      missed = false;
      setSample(latest);
    };
    const throttle = new CooldownThrottle(deliver, SAMPLE_COOLDOWN_MILLIS);
    shownRef.current = () => {if (missed) throttle.trigger();};
    const unsubscribe = pick(deps).subscribe(state => state.value, (value) => {
      latest = value;
      throttle.trigger();
    }, {fireImmediately: true});
    return () => {active = false; shownRef.current = undefined; unsubscribe();};
    // pick is a module-level constant at every call site, so deps is the only real dependency.
  }, [deps]);

  useEffect(() => {
    visibleRef.current = visible;
    if (visible) shownRef.current?.();
  }, [visible]);

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
