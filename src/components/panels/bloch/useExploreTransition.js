import { useCallback, useEffect, useRef } from "react";

import { blochVectorBetween, vectorFromAngles } from "../../../engine/math/bloch.js";
import { PRESET_TRANSITION, easeInOut } from "./analyzerModel.js";

/**
 * Moves the analyzer to a free, explored state: at once for a slider, or gliding there over
 * PRESET_TRANSITION for a preset. The glide turns the arrow along the sphere rather than through it
 * (blochVectorBetween). A new move cancels one still under way, and so does unmounting.
 *
 * @param {(mode: import("./analyzerModel.js").ViewMode) => void} setMode
 * @param {{ current: (import("./analyzerModel.js").BlochVector | undefined) }} shownVector The
 *     vector on screen now, where a glide starts from.
 */
function useExploreTransition(setMode, shownVector) {
  const animation = useRef(/** @type {number | undefined} */ (undefined));
  const cancel = useCallback(() => {
    if (animation.current !== undefined) cancelAnimationFrame(animation.current);
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
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / PRESET_TRANSITION);
      const vec = blochVectorBetween(from, to, easeInOut(t));
      setMode({ kind: "explore", vec: t < 1 ? vec : to, preset });
      if (t < 1) animation.current = requestAnimationFrame(frame);
    };
    animation.current = requestAnimationFrame(frame);
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
