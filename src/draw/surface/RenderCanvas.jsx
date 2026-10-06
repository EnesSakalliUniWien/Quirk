import { Application } from "@pixi/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
const emptyPresentation = createStore(() => ({}));
import { RenderSurface } from "./RenderSurface.js";
import { applicationOptions } from "./applicationOptions.js";
import { ReactScene } from "../scene/ReactScene.js";
import { reportBlockingIssue } from "../../diagnostics/errorReporter.js";

const reportInitializationFailure = (error) =>
  reportBlockingIssue("Rendering failed: " + error.message);

/** React owns presentation attributes; Pixi owns canvas sizing, events and scene objects. */
export function RenderCanvas({
  canvasRef,
  id,
  className,
  style,
  label,
  onReady,
}) {
  const [surface, setSurface] = useState(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  const init = useCallback(
    (app) => {
      if (canvasRef) canvasRef.current = app.canvas;
      setSurface(new RenderSurface(app.canvas, app));
    },
    [canvasRef],
  );
  useEffect(() => {
    if (!surface) return;
    ready.current?.(surface.canvas);
    return () => {
      void surface.destroy();
    };
  }, [surface]);
  return (
    <CanvasPresentation
      surface={surface}
      id={id}
      className={className}
      style={style}
      label={label}
    >
      <Application
        {...applicationOptions}
        onInit={init}
        onInitError={reportInitializationFailure}
      >
        {surface && <ReactScene surface={surface} />}
      </Application>
    </CanvasPresentation>
  );
}

/**
 * Each attribute is its own selector, so a write to the store that changes none of them, as most of
 * a frame's are, renders nothing.
 */
function CanvasPresentation({ surface, ...props }) {
  const store = surface?.presentation ?? emptyPresentation;
  const width = useStore(store, (state) => state.width);
  const height = useStore(store, (state) => state.height);
  const ready = useStore(store, (state) => state.ready);
  const circuit = useStore(store, (state) => state.circuit);
  return (
    <Presentation
      {...props}
      width={width}
      height={height}
      ready={ready}
      circuit={circuit}
    />
  );
}
function Presentation({
  id,
  className,
  style,
  label,
  width,
  height,
  ready,
  circuit,
  children,
}) {
  return (
    <div
      id={id}
      className={`render-canvas ${className ?? ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      data-renderer={ready ? "pixijs" : undefined}
      data-circuit={circuit}
      style={{
        ...style,
        width: width ?? style?.width,
        height: height ?? style?.height,
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
}
