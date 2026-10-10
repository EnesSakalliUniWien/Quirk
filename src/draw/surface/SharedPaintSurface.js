import { RenderSurface } from "./RenderSurface.js";

/** The surface of every canvas painted into, so that its scene can be freed once the canvas is gone. */
const painted = new Map();
/** How long after the last painting the scenes of canvases that have gone are freed, if nothing else is. */
const SWEEP_DELAY_MILLIS = 1000;
let sweep;

/**
 * Frees the scene of each canvas React has since taken out of the page. A panel does not say when its
 * canvas goes, and a scene nothing will paint again would sit in the renderer for good. A canvas with
 * a frame still on its way is left to finish it.
 */
function releaseGone(except) {
  for (const [canvas, surface] of painted) {
    if (
      canvas === except ||
      canvas.isConnected ||
      surface.pending ||
      surface.rendering > 0
    )
      continue;
    painted.delete(canvas);
    void RenderSurface.release(canvas);
  }
}

/**
 * Paints a scene into a canvas that a panel shows, through the one renderer every surface that copies
 * its pixels out shares (SharedRenderer), so that no panel holds a WebGL context of its own.
 *
 * Each canvas keeps a scene of its own between paints, so a panel that repaints reuses its Pixi
 * objects, and another panel painting in between does not take them away. The scene goes once the
 * canvas has left the page, at the next painting or a second after the last.
 *
 * @param {!HTMLCanvasElement} canvas
 * @param {!number} width The size to show the canvas at, in CSS pixels.
 * @param {!number} height
 * @param {function(!Object): void} draw Describes the scene.
 * @param {function(): boolean=} isCurrent Whether the painting is still wanted. It is asked before the
 *     scene is described and again just before it is drawn into the canvas, which a painting that is
 *     no longer wanted leaves as it is.
 * @returns {!Promise.<boolean>} Whether the canvas now shows the painting.
 */
async function paintInto(canvas, width, height, draw, isCurrent = () => true) {
  if (!isCurrent()) return false;
  releaseGone(canvas);
  // Nothing paints once the last panel has closed, and its scenes would stay for the renderer's life.
  clearTimeout(sweep);
  sweep = setTimeout(() => releaseGone(), SWEEP_DELAY_MILLIS);
  const surface = RenderSurface.forCanvas(canvas);
  painted.set(canvas, surface);
  try {
    draw(surface.beginCssFrame(width, height));
    await surface.render(surface.view, isCurrent);
  } catch (error) {
    // The next painting starts a scene afresh, on a renderer that has not failed.
    painted.delete(canvas);
    surface.reportFailure(error);
    await RenderSurface.release(canvas);
    throw error;
  }
  return isCurrent();
}

export { paintInto };
