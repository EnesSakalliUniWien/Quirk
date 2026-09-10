import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";

import { startQuirk } from "../../app/QuirkApp.js";
import { setErrorBannerHost } from "../../diagnostics/errorReporter.js";
import { appStore } from "../../state/appStore.js";
import { openPanel } from "../dock.jsx";

/**
 * The circuit itself, as a dock panel: the scrolling cell, its canvas, the zoom and overview
 * overlay, and the error banner that floats over them.
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
      showWelcome: () => openPanel("menu"),
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
      </div>
      <div id="circuit-overlay" ref={circuitOverlayRef} />
      {/* The error banner floats over the circuit; errorReporter.js fills it. */}
      <div id="error-banner-root" ref={errorBannerRef} />
    </div>
  );
}

export { CircuitPanel };
