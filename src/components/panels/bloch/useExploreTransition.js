import { useCallback, useEffect, useRef } from "react";

import { vectorFromAngles } from "../../../engine/math/bloch.js";
import { PRESET_TRANSITION } from "./analyzerModel.js";

/** Ease in, then out: a preset starts and lands gently. @param {number} t in [0, 1] */
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Moves the analyzer to a free, explored state: at once for a slider, or gliding there over
 * PRESET_TRANSITION for a preset. A new move cancels one still under way, and so does unmounting.
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
      const e = ease(t);
      const vec = {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        z: from.z + (to.z - from.z) * e,
      };
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
