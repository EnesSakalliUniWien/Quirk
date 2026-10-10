import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Suite, assertThat } from "../../TestUtil.js";
import { Matrix } from "../../../src/engine/math/matrix/Matrix.js";
import { stateGrid } from "../../../src/draw/renderers/dataRenderers.js";
import { RenderSurface } from "../../../src/draw/surface/RenderSurface.js";
import { DataView } from "../../../src/components/math/data-view.jsx";
import { PanelVisibility } from "../../../src/components/panels/shared/usePanelVisibility.js";

const suite = new Suite("DataView");

async function until(condition, timeout = 4000) {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > timeout)
      throw new Error("The view was never painted.");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
/** Long enough for a painting that was going to happen to have happened. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

const gridOf = (step) =>
  stateGrid(
    Matrix.col(
      ...Array.from({ length: 16 }, (_, i) => ((i % step) + 1) / (step + 2)),
    ),
  );

/**
 * A view 100 pixels square in a scroller of the same size. It sits a screen's height down unless
 * `near`, so that it starts out of view.
 */
function mountView() {
  const host = document.createElement("div");
  host.style.cssText =
    "position: fixed; left: 0; top: 0; width: 100px; height: 100px; overflow: auto;";
  document.body.append(host);
  const root = createRoot(host);
  return {
    host,
    render: ({ showing = true, near = true, data }) =>
      flushSync(() =>
        root.render(
          createElement(
            PanelVisibility.Provider,
            { value: showing },
            createElement("div", { style: { height: near ? "0px" : "400px" } }),
            createElement(DataView, {
              kind: "state",
              data,
              width: 100,
              height: 100,
              label: "A state",
            }),
          ),
        ),
      ),
    canvas: () => host.querySelector("canvas"),
    pixels: () => host.querySelector("canvas").toDataURL(),
    painted: () => host.querySelector("canvas").dataset.painted === "true",
    unmount: async () => {
      const canvas = host.querySelector("canvas");
      root.unmount();
      host.remove();
      if (canvas) await RenderSurface.release(canvas);
    },
  };
}

suite.test(
  "a view that is scrolled out of its panel is not painted, and is once it scrolls into view",
  async () => {
    const view = mountView();
    try {
      view.render({ near: false, data: gridOf(3) });
      await settle();
      assertThat(view.painted()).isEqualTo(false);
      const blank = view.pixels();
      view.host.scrollTop = 400;
      await until(view.painted);
      assertThat(view.pixels() === blank).isEqualTo(false);
    } finally {
      await view.unmount();
    }
  },
);

suite.test(
  "a view in a dock panel that is not showing is not painted, and is once the panel shows",
  async () => {
    const view = mountView();
    try {
      view.render({ showing: false, data: gridOf(3) });
      await settle();
      assertThat(view.painted()).isEqualTo(false);
      view.render({ data: gridOf(3) });
      await until(view.painted);
    } finally {
      await view.unmount();
    }
  },
);

suite.test(
  "a view that is not shown keeps what it had while its data changes, and paints the latest data once shown",
  async () => {
    const view = mountView();
    try {
      view.render({ data: gridOf(3) });
      await until(view.painted);
      const first = view.pixels();
      // The flag is how the page knows a painting is in; clearing it shows whether one comes.
      delete view.canvas().dataset.painted;
      view.render({ showing: false, data: gridOf(5) });
      await settle();
      assertThat(view.painted()).isEqualTo(false);
      assertThat(view.pixels()).isEqualTo(first);
      view.render({ data: gridOf(5) });
      await until(view.painted);
      const latest = view.pixels();
      assertThat(latest === first).isEqualTo(false);
      // What is painted is what painting the same data alone would have been.
      view.render({ data: gridOf(3) });
      await until(() => view.pixels() === first);
    } finally {
      await view.unmount();
    }
  },
);
