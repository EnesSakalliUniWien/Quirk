import { useColourScheme } from "../useColourScheme.js";
import { useEffect, useRef, useState } from "react";
import { clock } from "../../base/Clock.js";
import { RenderCanvas } from "../../draw/surface/RenderCanvas.jsx";
import { CanvasTheme } from "../../config/CanvasTheme.js";
import { Rect } from "../../geometry/Rect.js";
import { RenderSurface } from "../../draw/surface/RenderSurface.js";
import { drawCircuitTooltip } from "../../editor/rendering/previews/CircuitPreview.js";
import { drawingArea } from "../../draw/scene/DisplayView.js";
import { rectangle } from "../../draw/shapes/ShapeView.js";
import { useTextScale } from "../useTextScale.js";

/**
 * One retained circuit preview, with its animation and resize subscriptions owned by the view.
 * With followsText it is drawn larger or smaller by its host's text size, as the gate details
 * popup's follows the browser's.
 */
export function CircuitFigure({
  circuit,
  time,
  responsive = false,
  animate = false,
  cycleTime,
  followsText = false,
}) {
  const scheme = useColourScheme();
  const canvasRef = useRef(null);
  const host = useRef(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(300);
  const scale = useTextScale(host, followsText);
  // The height in the circuit's units; on screen it is scaled with the drawing.
  const height = Math.max(100, Math.min(240, circuit.numWires * 45 + 40));
  const shownHeight = Math.round(height * scale);
  useEffect(() => {
    if (!responsive) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(1, Math.floor(entries[0].contentRect.width))),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [responsive]);
  useEffect(() => {
    if (!ready || !canvasRef.current) return;
    const draw = () => {
      // The scale rides on the pixel ratio, as the circuit's zoom does.
      const painter = RenderSurface.forCanvas(canvasRef.current).beginCssFrame(
        width,
        shownHeight,
        scale,
      );
      rectangle(painter, drawingArea(painter), {
        fill: CanvasTheme.surface.gate,
      });
      drawCircuitTooltip(
        painter,
        circuit,
        new Rect(0, 0, width / scale, height),
        true,
        cycleTime ? cycleTime() : time,
      );
      painter.tooltips?.flush();
    };
    draw();
    return animate ? clock.onFrame(draw) : undefined;
  }, [
    ready,
    width,
    height,
    shownHeight,
    scale,
    circuit,
    time,
    animate,
    cycleTime,
    scheme,
  ]);
  return (
    <div
      ref={host}
      className={responsive ? "responsive-circuit-figure" : undefined}
      style={{ width: responsive ? "100%" : 300 }}
    >
      <RenderCanvas
        canvasRef={canvasRef}
        onReady={() => setReady(true)}
        className="circuit-figure"
        style={{ width, height: shownHeight }}
        label="The circuit this gate stands for"
      />
    </div>
  );
}
