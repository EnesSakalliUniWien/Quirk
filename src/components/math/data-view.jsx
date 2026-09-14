import { useEffect, useRef } from "react";

import { paintInto } from "../../draw/surface/SharedPaintSurface.js";
import { DATA_RENDERERS } from "../../draw/renderers/dataRenderers.js";
import { rasterMatrix } from "../../draw/renderers/rasters.js";
import { Rect } from "../../geometry/Rect.js";

/** Below this many pixels per entry, discs and hands are too small to read. */
const MIN_MARK_PIXELS = 4;
/** The kinds that can also be drawn as one pixel per entry, and how. */
const PIXEL_RENDERERS = { matrix: rasterMatrix, state: rasterMatrix };

/**
 * A piece of data drawn by its renderer - the same renderer the circuit's display gates use - on
 * the shared GPU surface (src/draw/surface/SharedPaintSurface.js).
 *
 * When the entries get smaller than MIN_MARK_PIXELS the view switches to pixels - one per entry,
 * or one per block of entries - so a state over 16 qubits still draws at once (src/draw/renderers/
 * rasters.js). `data-detail` says which: "marks" or "pixels".
 *
 * `data-painted` is set once the pixels are in, which is also how a test knows the view is drawn.
 *
 * @param {!{kind: ("matrix"|"state"|"probabilities"), data: (undefined|!Matrix), width: !number,
 *     height: !number, options: (undefined|!Object), label: !string, className: (undefined|!string)}} props
 *     options must hold plain values: it is compared by content, so a caller need not memoise it.
 */
function DataView({ kind, data, width, height, options, label, className }) {
  const ref = useRef(null);
  const optionsKey = JSON.stringify(options ?? {});

  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null || data === undefined) {
      return undefined;
    }
    const perEntry = Math.min(width / data.width(), height / data.height());
    if (perEntry < MIN_MARK_PIXELS && PIXEL_RENDERERS[kind] !== undefined) {
      const ratio = window.devicePixelRatio || 1;
      const pixelWidth = Math.max(1, Math.round(width * ratio));
      const pixelHeight = Math.max(1, Math.round(height * ratio));
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      const pixels = PIXEL_RENDERERS[kind](data, pixelWidth, pixelHeight);
      canvas.getContext("2d").putImageData(new ImageData(pixels, pixelWidth, pixelHeight), 0, 0);
      canvas.dataset.detail = "pixels";
      canvas.dataset.painted = "true";
      return undefined;
    }
    canvas.dataset.detail = "marks";
    let current = true;
    const rect = new Rect(0, 0, width, height);
    paintInto(
      canvas,
      width,
      height,
      (view) => DATA_RENDERERS[kind](view, data, rect, JSON.parse(optionsKey)),
      () => current,
    ).then((painted) => {
      if (painted !== false && current) {
        canvas.dataset.painted = "true";
      }
    }, () => {
      // The rendering surface reports failures; leave this canvas unpainted for a later update.
    });
    return () => {
      current = false;
    };
  }, [kind, data, width, height, optionsKey]);

  return (
    <canvas
      ref={ref}
      className={className ?? "data-view"}
      role="img"
      aria-label={label}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}

export { DataView };
