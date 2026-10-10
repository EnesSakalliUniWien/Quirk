import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { CooldownThrottle } from "../../../base/CooldownThrottle.js";
import { appStore } from "../../../state/appStore.js";
import { motionSettings } from "../../../state/motionSettings.js";
import { usePanelVisibility } from "./usePanelVisibility.js";

/**
 * The simulator's completed result, sampled no faster than a panel can be read, or than the user's
 * panel refresh interval. The circuit redraws
 * every frame; re-deriving a table, a chart or a list of matrices that often would spend the whole
 * frame budget on something nobody can read that fast.
 *
 * A panel behind another tab of its group stays mounted, and nobody reads it at all: it keeps the
 * sample it has until it is shown again, and then takes the newest one at once. A time-dependent
 * gate has the simulator publishing every frame, and the algebra panel's re-derivation alone would
 * otherwise hold the whole app at a few frames a second from behind its tab.
 *
 * @returns {*} The latest sample, or undefined before the circuit has started.
 */
function useCompletedResult() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  const cooldownMs = useStore(
    deps?.settings ?? motionSettings,
    (s) => s.panelSampleMs,
  );
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
    const throttle = new CooldownThrottle(deliver, cooldownMs);
    shownRef.current = () => {
      if (missed) throttle.trigger();
    };
    const unsubscribe = deps.completed.subscribe(
      (state) => state.value,
      (value) => {
        latest = value;
        throttle.trigger();
      },
      { fireImmediately: true },
    );
    return () => {
      active = false;
      shownRef.current = undefined;
      unsubscribe();
    };
    // deps and the user's interval are the effect's only dependencies.
  }, [deps, cooldownMs]);

  useEffect(() => {
    visibleRef.current = visible;
    if (visible) shownRef.current?.();
  }, [visible]);

  return sample;
}

/**
 * The stats as far as the playhead has run, with the number of wires the circuit shows.
 *
 * @returns {undefined|!{stats: !CircuitStats, wireCount: !int}}
 */
function usePlayheadStats() {
  return useCompletedResult();
}

export { usePlayheadStats, useCompletedResult };
