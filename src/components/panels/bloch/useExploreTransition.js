import { useCallback, useEffect, useRef } from "react";

import { blochVectorBetween, vectorFromAngles } from "../../../engine/math/bloch.js";
import { clock } from "../../../base/Clock.js";
import { Animation } from "../../../config/Animation.js";

/**
 * Moves the analyzer to a free, explored state: at once for a slider, or gliding there over
 * Animation.GLIDE_DURATION_MS for a preset. The glide turns the arrow along the sphere rather than through it
 * (blochVectorBetween). A new move cancels one still under way, and so does unmounting.
 *
 * @param {(mode: import("./analyzerModel.js").ViewMode) => void} setMode
 * @param {{ current: (import("./analyzerModel.js").BlochVector | undefined) }} shownVector The
 *     vector on screen now, where a glide starts from.
 */
function useExploreTransition(setMode, shownVector) {
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
    if (!glide) {
      setMode({ kind: "explore", vec: to, preset });
      return;
    }
    const start = clock.now();
    animation.current = clock.onFrame((now) => {
      const t = Math.min(1, (now - start) / Animation.GLIDE_DURATION_MS);
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
