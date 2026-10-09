import { useCallback, useEffect, useRef } from "react";

import { blochVectorBetween, vectorFromAngles } from "../../../engine/math/bloch.js";
import { clock } from "../../../base/Clock.js";
import { prefersReducedMotion } from "../../../browser/reducedMotion.js";
import { Animation } from "../../../config/Animation.js";
import { motionSettings } from "../../../state/motionSettings.js";

/**
 * Moves the analyzer to a free, explored state: at once for a slider, or gliding there over
 * the user's glide duration for a preset. The glide turns the arrow along the sphere rather than through it
 * (blochVectorBetween). With Reduce Motion on, a preset lands at once too. A new move cancels one
 * still under way, and so does unmounting.
 *
 * @param {(mode: import("./analyzerModel.js").ViewMode) => void} setMode
 * @param {{ current: (import("./analyzerModel.js").BlochVector | undefined) }} shownVector The
 *     vector on screen now, where a glide starts from.
 * @param {import("zustand/vanilla").StoreApi=} settings The user's settings, for the glide's
 *     duration, which a glide keeps from its start.
 */
function useExploreTransition(setMode, shownVector, settings = motionSettings) {
  const animation = useRef(/** @type {(() => void) | undefined} */ (undefined));
  const cancel = useCallback(() => {
    animation.current?.();
    animation.current = undefined;
  }, []);

  useEffect(() => cancel, [cancel]);

  /**
   * @param {import("./analyzerModel.js").BlochVector} to
   * @param {{ preset?: string, glide?: boolean }=} options
   */
  const explore = (to, { preset, glide = false } = {}) => {
    cancel();
    const from = shownVector.current ?? to;
    const glideMs = settings.getState().glideMs;
    if (!glide || glideMs <= 0 || prefersReducedMotion()) {
      setMode({ kind: "explore", vec: to, preset });
      return;
    }
    const start = clock.now();
    animation.current = clock.onFrame((now) => {
      const t = Math.min(1, (now - start) / glideMs);
      const vec = blochVectorBetween(from, to, Animation.GLIDE_EASING(t));
      setMode({ kind: "explore", vec: t < 1 ? vec : to, preset });
      if (t >= 1) cancel();
    });
  };

  /** @param {number} thetaDegrees @param {number} phiDegrees */
  const exploreAngles = (thetaDegrees, phiDegrees) =>
    explore(
      vectorFromAngles(
        (thetaDegrees * Math.PI) / 180,
        (phiDegrees * Math.PI) / 180,
      ),
    );

  return { explore, exploreAngles, cancel };
}

export { useExploreTransition };
