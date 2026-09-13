import { ScanIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Format } from "../../base/Format.js";
import { Util } from "../../base/Util.js";
import {
  TILE_SIZE,
  cancelTile,
  loadTile,
  peekTile,
  tileKey,
} from "../../draw/renderers/operatorTiles.js";
import { Complex } from "../../engine/math/complex/Complex.js";
import { columnImage } from "../../engine/simulation/columnStructure.js";
import { rasterMatrix } from "../../draw/renderers/rasters.js";
import { Button } from "../ui/button.jsx";
import { ButtonGroup } from "../ui/button-group.jsx";

/** The closest zoom shows one entry this many CSS pixels a side. */
const MAX_ENTRY_PIXELS = 32;
/** Each zoom button doubles or halves the scale. */
const ZOOM_STEP = 2;
/** The whole operator, centred. */
const FIT = { scale: 1, cx: 0.5, cy: 0.5 };

/**
 * Keeps the view inside the operator.
 *
 * @param {!{scale: !number, cx: !number, cy: !number}} view Scale 1 shows everything; the centre is
 *     a fraction of the operator's side.
 */
function clampView(view, maxScale) {
  const scale = Math.min(maxScale, Math.max(1, view.scale));
  const half = 0.5 / scale;
  const clamp = (v) => Math.min(1 - half, Math.max(half, v));
  return { scale, cx: clamp(view.cx), cy: clamp(view.cy) };
}

/**
 * The tiles that cover the view, at the coarsest level with at least one tile pixel per screen
 * pixel - the way a map picks its zoom level.
 *
 * @returns {!{level: !int, tiles: !Array.<!{x: !int, y: !int}>, left: !number, top: !number, extent: !number}}
 */
function visibleTiles(view, wireCount, pixels) {
  const maxLevel = Math.max(0, wireCount - Math.log2(TILE_SIZE));
  const wanted = Math.ceil(Math.log2((view.scale * pixels) / TILE_SIZE));
  const level = Math.max(0, Math.min(maxLevel, wanted));
  const count = 1 << level;
  const extent = 1 / view.scale;
  const left = view.cx - extent / 2;
  const top = view.cy - extent / 2;
  const tiles = [];
  for (let y = Math.max(0, Math.floor(top * count)); y < Math.min(count, Math.ceil((top + extent) * count)); y++) {
    for (let x = Math.max(0, Math.floor(left * count)); x < Math.min(count, Math.ceil((left + extent) * count)); x++) {
      tiles.push({ x, y });
    }
  }
  return { level, tiles, left, top, extent };
}

/**
 * Draws the tiles of the view that are ready, and the nearest drawn coarser tile stretched over
 * each one that is not, so the picture sharpens instead of flashing.
 *
 * @returns {!{keys: !Set.<!string>, missing: !Array.<!{key: !string, x: !int, y: !int}>, level: !int}}
 */
function drawView(canvas, source, view) {
  const pixels = canvas.width;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, pixels, pixels);
  context.imageSmoothingEnabled = false;
  const { level, tiles, left, top, extent } = visibleTiles(view, source.wireCount, pixels);
  const count = 1 << level;
  const side = (pixels / count) / extent;
  const keys = new Set();
  const missing = [];
  for (const { x, y } of tiles) {
    const key = tileKey(source, level, x, y);
    keys.add(key);
    const dx = ((x / count - left) / extent) * pixels;
    const dy = ((y / count - top) / extent) * pixels;
    const bitmap = peekTile(key);
    if (bitmap !== undefined) {
      context.drawImage(bitmap, dx, dy, side, side);
      continue;
    }
    missing.push({ key, x, y });
    for (let up = 1; up <= level; up++) {
      const coarser = peekTile(tileKey(source, level - up, x >> up, y >> up));
      if (coarser !== undefined) {
        const part = TILE_SIZE / (1 << up);
        const within = (1 << up) - 1;
        context.drawImage(coarser, (x & within) * part, (y & within) * part, part, part, dx, dy, side, side);
        break;
      }
    }
  }
  return { keys, missing, level };
}

/**
 * An operator of any size, drawn tile by tile like a map. A worker draws each tile from the
 * column's structure (src/draw/renderers/operatorTiles.js), so a 16-qubit step - 65,536 entries a
 * side - is looked at the same way as a 3-qubit one: zoom in and the tiles get finer until each
 * entry is a square of its own. Hovering an entry reads its exact value off the structure.
 *
 * The hue is the entry's phase and its strength the magnitude, as in the circuit's displays.
 * Zoom with the buttons, ctrl+scroll, a pinch, a double click or + and -; pan by dragging or with
 * the arrow keys. A plain scroll is left to whatever scrolls around the view.
 *
 * @param {!{source: !{json: !string, col: !int, wireCount: !int, time: !number},
 *     structure: !ColumnStructure, size: !number, label: !string,
 *     formatKet: (undefined|!function(!int): !string)}} props
 *     formatKet writes a basis state for the readout; bits by default.
 */
function OperatorView({ source, structure, matrix, size, label, formatKet }) {
  const { json, col, wireCount, time } = source ?? {wireCount: Math.log2(matrix.height())};
  const tileSource = useMemo(() => ({ json, col, wireCount, time }), [json, col, wireCount, time]);
  const canvasRef = useRef(null);
  const requested = useRef(new Set());
  const dragFrom = useRef(undefined);
  const [view, setView] = useState(FIT);
  const [arrivals, setArrivals] = useState(0);
  const [hovered, setHovered] = useState(undefined);
  const [selected, setSelected] = useState({row: 0, col: 0});
  const [failure, setFailure] = useState(undefined);
  const side = 1 << wireCount;
  const maxScale = Math.max(1, (side * MAX_ENTRY_PIXELS) / size);
  useEffect(() => setView(v => clampView(v, maxScale)), [maxScale]);
  // Dense matrices are already bounded by their caller. One pixel per entry gives zoom the
  // original values without allocating a larger matrix or involving the structure worker.
  const denseImage = useMemo(() => {
    if (matrix === undefined) return undefined;
    const image = document.createElement("canvas");
    image.width = matrix.width();
    image.height = matrix.height();
    image.getContext("2d").putImageData(new ImageData(rasterMatrix(matrix, image.width, image.height), image.width, image.height), 0, 0);
    return image;
  }, [matrix]);

  const zoomAt = useCallback(
    (factor, fx = 0.5, fy = 0.5) =>
      setView((v) => {
        // The point under the pointer stays under it.
        const px = v.cx + (fx - 0.5) / v.scale;
        const py = v.cy + (fy - 0.5) / v.scale;
        const scale = Math.min(maxScale, Math.max(1, v.scale * factor));
        return clampView({ scale, cx: px - (fx - 0.5) / scale, cy: py - (fy - 0.5) / scale }, maxScale);
      }),
    [maxScale],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    const pixels = Math.max(1, Math.round(size * ratio));
    if (canvas.width !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    if (denseImage !== undefined) {
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, pixels, pixels);
      context.imageSmoothingEnabled = false;
      const extent = side / view.scale;
      context.drawImage(denseImage, view.cx * side - extent / 2, view.cy * side - extent / 2,
        extent, extent, 0, 0, pixels, pixels);
      canvas.dataset.painted = "true";
      return;
    }
    const { keys, missing, level } = drawView(canvas, tileSource, view);
    for (const { key, x, y } of missing) {
      if (!requested.current.has(key)) {
        requested.current.add(key);
        const settle = () => requested.current.delete(key);
        loadTile(key, tileSource, level, x, y).then(
          () => {
            settle();
            setArrivals((n) => n + 1);
          },
          (error) => {
            settle();
            // A cancelled tile is no failure; one the worker could not draw is, and says why.
            if (error?.name !== "AbortError") {
              setFailure({ source: tileSource, message: error?.message ?? String(error) });
            }
          },
        );
      }
    }
    // Tiles asked for earlier that this view no longer shows.
    for (const key of [...requested.current]) {
      if (!keys.has(key)) {
        cancelTile(key);
        requested.current.delete(key);
      }
    }
    canvas.dataset.level = String(level);
    if (missing.length === 0) {
      canvas.dataset.painted = "true";
    } else {
      delete canvas.dataset.painted;
    }
  }, [tileSource, view, size, arrivals, denseImage, side]);

  useEffect(() => {
    const pending = requested.current;
    return () => {
      for (const key of pending) {
        cancelTile(key);
      }
      pending.clear();
    };
  }, []);

  // Ctrl+scroll and pinches zoom. The listener is not passive, so it can keep the page from zooming.
  useEffect(() => {
    const canvas = canvasRef.current;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const r = canvas.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.01), (event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const entryAt = (event) => {
    const r = event.currentTarget.getBoundingClientRect();
    const extent = 1 / view.scale;
    const x = view.cx - extent / 2 + ((event.clientX - r.left) / r.width) * extent;
    const y = view.cy - extent / 2 + ((event.clientY - r.top) / r.height) * extent;
    const clamp = (v) => Math.min(side - 1, Math.max(0, Math.floor(v * side)));
    return { row: clamp(y), col: clamp(x) };
  };

  const onPointerMove = (event) => {
    const from = dragFrom.current;
    if (from !== undefined) {
      const r = event.currentTarget.getBoundingClientRect();
      const dx = (event.clientX - from.x) / r.width;
      const dy = (event.clientY - from.y) / r.height;
      dragFrom.current = { x: event.clientX, y: event.clientY };
      setView((v) => clampView({ ...v, cx: v.cx - dx / v.scale, cy: v.cy - dy / v.scale }, maxScale));
    }
    // Kept while the pointer stays on one entry, so its value is worked out once, not per move:
    // for a column that spreads over the whole register that is 65,536 amplitudes a time.
    const next = entryAt(event);
    setHovered((current) =>
      current !== undefined && current.row === next.row && current.col === next.col ? current : next,
    );
  };

  const onKeyDown = (event) => {
    const pan = 0.25 / view.scale;
    const moves = {
      ArrowLeft: [-pan, 0],
      ArrowRight: [pan, 0],
      ArrowUp: [0, -pan],
      ArrowDown: [0, pan],
    };
    if (event.key === "+" || event.key === "=") {
      zoomAt(ZOOM_STEP);
    } else if (event.key === "-") {
      zoomAt(1 / ZOOM_STEP);
    } else if (event.key === "0") {
      setView(FIT);
    } else if (moves[event.key] !== undefined) {
      const [dx, dy] = moves[event.key];
      setView((v) => clampView({ ...v, cx: v.cx + dx, cy: v.cy + dy }, maxScale));
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  // The exact entry under the pointer, from the structure rather than the pixels.
  const readout = useMemo(() => {
    const entry = hovered ?? {row: Math.min(side - 1, selected.row), col: Math.min(side - 1, selected.col)};
    const value = matrix === undefined ? undefined : matrix.cell(entry.col, entry.row);
    const [re, im] = value === undefined ? columnImage(structure, entry.col).get(entry.row) ?? [0, 0] : [value.real, value.imag];
    const ket = formatKet ?? ((index) => Util.bin(index, wireCount));
    return {
      entry: `⟨${ket(entry.row)}|U|${ket(entry.col)}⟩`,
      value: new Complex(re, im).toString(Format.SIMPLIFIED),
    };
  }, [hovered, selected, structure, matrix, wireCount, formatKet, side]);
  const failed = failure !== undefined && failure.source === tileSource ? failure.message : undefined;

  return (
    <div className="operator-view">
      <canvas
        ref={canvasRef}
        className="operator-view-canvas"
        role="img"
        aria-label={`${label}, ${side} by ${side}`}
        tabIndex={0}
        style={{ width: `${size}px`, height: `${size}px` }}
        onPointerDown={(event) => {
          if (event.button === 0) {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragFrom.current = { x: event.clientX, y: event.clientY };
          }
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          dragFrom.current = undefined;
        }}
        onPointerCancel={() => {
          dragFrom.current = undefined;
        }}
        onPointerLeave={() => setHovered(undefined)}
        onDoubleClick={(event) => {
          const r = event.currentTarget.getBoundingClientRect();
          zoomAt(ZOOM_STEP, (event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="operator-view-bar">
        <ButtonGroup aria-label="Zoom">
          <Button size="icon" aria-label="Zoom out" disabled={view.scale <= 1} onClick={() => zoomAt(1 / ZOOM_STEP)}>
            <ZoomOutIcon aria-hidden="true" />
          </Button>
          <Button size="icon" aria-label="Zoom in" disabled={view.scale >= maxScale} onClick={() => zoomAt(ZOOM_STEP)}>
            <ZoomInIcon aria-hidden="true" />
          </Button>
          <Button size="icon" aria-label="Show all" disabled={view.scale <= 1} onClick={() => setView(FIT)}>
            <ScanIcon aria-hidden="true" />
          </Button>
        </ButtonGroup>
        <span className="operator-view-zoom">{`×${Math.round(view.scale * 10) / 10}`}</span>
      </div>
      <div className="operator-entry-controls">
        {["row", "col"].map(axis => <label key={axis}>
          {axis === "row" ? "Output row" : "Input column"}
          <input type="number" min={0} max={side - 1} step={1}
            aria-label={axis === "row" ? "Output row" : "Input column"}
            value={Math.min(side - 1, selected[axis])}
            onFocus={() => setHovered(undefined)}
            onChange={event => {
              const value = event.target.valueAsNumber;
              if (!Number.isInteger(value)) return;
              const next = {...selected, [axis]: Math.min(side - 1, Math.max(0, value))};
              setHovered(undefined);
              setSelected(next);
              setView(v => clampView({...v, cx: (next.col + 0.5) / side, cy: (next.row + 0.5) / side}, maxScale));
            }} />
        </label>)}
      </div>
      <p className="operator-view-readout" aria-live="polite">
        {failed !== undefined ? (
          `The matrix could not be drawn: ${failed}`
        ) : readout === undefined ? (
          "Hover an entry for its value"
        ) : (
          <>
            <span>{readout.entry}</span> <span>{`= ${readout.value}`}</span>
          </>
        )}
      </p>
    </div>
  );
}

export { OperatorView };
