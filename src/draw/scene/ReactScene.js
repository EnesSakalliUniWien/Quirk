import { Rectangle } from "pixi.js";
import {
  Component,
  createElement,
  useCallback,
  useLayoutEffect,
  useState,
} from "react";
import { useStore } from "zustand";

/** Effects run after Pixi refs commit. Tooltips need the committed source transforms. */
export function ReactScene({ surface }) {
  useLayoutEffect(() => {
    surface.didMount?.();
    return () => queueMicrotask(() => surface.didUnmount?.());
  }, [surface]);
  return createElement(
    SceneErrorBoundary,
    { surface },
    createElement(SceneContents, { surface }),
  );
}

class SceneErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    this.props.surface.failure = error;
    this.props.surface.frames.getState().request?.reject(error);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

function SceneContents({ surface }) {
  const request = useStore(surface.frames, (state) => state.request);
  const [overlay, setOverlay] = useState(null);
  // A surface that copies its pixels out is drawn from its own container, so it is known by it.
  const keepRoot = useCallback(
    (node) => {
      if (node) surface.root = node;
    },
    [surface],
  );
  useLayoutEffect(() => {
    if (!request) return;
    if (surface.disposed) {
      request.resolve();
      return;
    }
    const app = surface.app;
    app.stage.scale.set(request.ratio);
    if (surface.shared) {
      // The pointer lands on the canvas the pixels are copied into, never on this scene.
      app.stage.eventMode = "none";
    } else {
      app.stage.eventMode = "static";
      app.stage.hitArea = new Rectangle(
        0,
        0,
        request.width / request.ratio,
        request.height / request.ratio,
      );
    }
    if (request.tooltips.length && overlay?.request !== request) {
      setOverlay({
        request,
        element: request.view.tooltips.element(request.tooltips, app.stage),
      });
      return;
    }
    try {
      if (surface.shared) {
        // A frame that has become stale leaves the canvas as the frame before it drew it.
        if (request.isCurrent?.() !== false)
          surface.shared.draw(surface, request.width, request.height);
      } else {
        if (
          app.canvas.width !== request.width ||
          app.canvas.height !== request.height
        ) {
          app.renderer.resize(request.width, request.height, 1);
        }
        // Shown one backing pixel per device pixel, set in the same commit as the resize: a
        // store kept larger than its element while the element resizes is clipped by the
        // element, not squeezed. The scene's ratio also carries the circuit's zoom, so the
        // device's is used.
        const deviceRatio = window.devicePixelRatio || 1;
        const width = `${request.width / deviceRatio}px`;
        const height = `${request.height / deviceRatio}px`;
        if (app.canvas.style.width !== width) app.canvas.style.width = width;
        if (app.canvas.style.height !== height)
          app.canvas.style.height = height;
        app.render();
      }
      surface.presentation.setState({ ready: true, circuit: request.circuit });
      request.resolve();
    } catch (error) {
      request.reject(error);
    }
  }, [request, overlay, surface]);
  return createElement(
    "pixiSceneContainer",
    { ref: surface.shared ? keepRoot : undefined },
    request?.element,
    request?.tooltips.length ? overlay?.element : null,
  );
}
