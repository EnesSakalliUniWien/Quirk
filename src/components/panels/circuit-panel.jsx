import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";

import { startQuirk } from "../../app/QuirkApp.js";
import { setErrorBannerHost } from "../../diagnostics/errorReporter.js";
import { appStore } from "../../state/appStore.js";
import { openPanel } from "../dock.jsx";
import { GutterEditors } from "../circuit/gutter-editors.jsx";

/**
 * The circuit itself, as a dock panel: the scrolling cell, its canvas, the bar under it holding the
 * zoom and the overview, and the error banner that floats over them.
 *
 * The elements are React's; what happens inside them is not. On mount they are handed to
 * startQuirk, which drives them imperatively - which is what a WebGL surface wants - and publishes
 * what the rest of the shell needs through the app store. The ids are style and test hooks only.
 */
function CircuitPanel() {
  const canvasRef = useRef(null);
  const canvasDivRef = useRef(null);
  const scrollSpacerRef = useRef(null);
  const circuitOverlayRef = useRef(null);
  const errorBannerRef = useRef(null);

  useEffect(() => {
    setErrorBannerHost(errorBannerRef.current);
    startQuirk({
      canvas: canvasRef.current,
      canvasDiv: canvasDivRef.current,
      scrollSpacer: scrollSpacerRef.current,
      circuitOverlay: circuitOverlayRef.current,
      // Flushed, not batched: the redraw loop starts on the next line, and its first frame should
      // land in a shell that is already showing.
      onReady: () => flushSync(() => appStore.setState({ booted: true })),
      // Clicking a parametrized gate's button, or a Bloch sphere, opens its panel. The target is
      // transient state rather than a panel parameter, so it never reaches the saved layout.
      openGateParamEditor: (found) => {
        appStore.setState({ gateParamTarget: found });
        openPanel("gate-param");
      },
      openBlochSphereView: (target) => {
        appStore.setState({ blochTarget: target });
        openPanel("bloch");
      },
      openRegisterRename: (name, rect) => {
        appStore.setState({ registerRename: { name, rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h } } });
      },
      openGutterMenu: ({ wire, register, rect, x, y }) =>
        appStore.setState({
          gutterMenu: {
            wire,
            register,
            rect: rect === undefined ? undefined : { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
            x,
            y,
          },
        }),
    });
  }, []);

  return (
    <div id="circuit-area">
      <div
        id="canvasDiv"
        ref={canvasDivRef}
        style={{ touchAction: "manipulation", position: "relative" }}
      >
        <canvas id="drawCanvas" ref={canvasRef} />
        {/* Carries the scroll extent, so the canvas can stay viewport-sized. */}
        <div id="canvas-scroll-spacer" ref={scrollSpacerRef} aria-hidden="true" />
        {/* The rename box and the wire-label menu sit in the scroll content, over the drawing. */}
        <GutterEditors host={canvasDivRef} />
      </div>
      <div id="circuit-overlay" ref={circuitOverlayRef} />
      {/* The error banner floats over the circuit; errorReporter.js fills it. */}
      <div id="error-banner-root" ref={errorBannerRef} />
    </div>
  );
}

export { CircuitPanel };
