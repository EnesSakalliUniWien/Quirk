import { useEffect, useRef } from "react";

import { CanvasTheme } from "../../config/CanvasTheme.js";
import { Rect } from "../../geometry/Rect.js";
import { RenderSurface } from "../../draw/pixi/RenderSurface.js";
import { drawCircuitTooltip } from "../../editor/DisplayedCircuit.js";
import { drawingArea } from "../../draw/pixi/DisplayView.js";
import { rectangle } from "../../draw/pixi/ShapeView.js";

/** The drawing's size in CSS pixels. Wide enough for a few columns without dwarfing the card. */
const WIDTH = 300;
const HEIGHT = 130;

/**
 * A custom gate's own circuit, drawn by the same painter the circuit itself uses.
 *
 * This one stays a canvas: it is a circuit, and the app already knows how to draw circuits. The
 * rest of the card is HTML because the rest of the card is text.
 *
 * @param {!{circuit: !CircuitDefinition, time: !number}} props
 */
function CircuitFigure({ circuit, time }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(WIDTH * ratio);
    canvas.height = Math.round(HEIGHT * ratio);
    const painter = RenderSurface.forCanvas(canvas).beginFrame(undefined, ratio);
    rectangle(painter, drawingArea(painter), { fill: CanvasTheme.surface.gate });
    drawCircuitTooltip(painter, circuit, new Rect(0, 0, WIDTH, HEIGHT), true, time);
    painter.tooltips?.flush();
  }, [circuit, time]);

  return (
    <canvas
      ref={canvasRef}
      className="circuit-figure"
      style={{ width: `${WIDTH}px`, height: `${HEIGHT}px` }}
      aria-label="The circuit this gate stands for"
    />
  );
}

export { CircuitFigure };
