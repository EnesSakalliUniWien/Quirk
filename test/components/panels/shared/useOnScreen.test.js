import { createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Suite, assertThat } from "../../../TestUtil.js";
import { useOnScreen } from "../../../../src/components/panels/shared/useOnScreen.js";
import { PanelVisibility } from "../../../../src/components/panels/shared/usePanelVisibility.js";

const suite = new Suite("useOnScreen");

/** Polls on timers: the observer reports between frames. */
async function until(condition, timeout = 2000) {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > timeout)
      throw new Error("The answer never changed.");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
/** Long enough for an observer that was going to report to have reported. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

/**
 * A scroller 100 pixels square holding two 50 pixel probes, the second a screen's height below the
 * first, and what each of them says about being on screen.
 */
function mountProbes(showing = true) {
  const host = document.createElement("div");
  host.style.cssText =
    "position: fixed; left: 0; top: 0; width: 100px; height: 100px; overflow: auto;";
  document.body.append(host);
  const root = createRoot(host);
  const seen = {};
  function Probe({ name }) {
    const ref = useRef(null);
    seen[name] = useOnScreen(ref);
    return createElement("div", {
      ref,
      style: { width: "50px", height: "50px" },
    });
  }
  const render = (visible) =>
    flushSync(() =>
      root.render(
        createElement(
          PanelVisibility.Provider,
          { value: visible },
          createElement(Probe, { name: "near" }),
          createElement("div", { style: { height: "400px" } }),
          createElement(Probe, { name: "far" }),
        ),
      ),
    );
  render(showing);
  return {
    host,
    seen,
    render,
    unmount: () => {
      root.unmount();
      host.remove();
    },
  };
}

suite.test(
  "an element is on screen while it is inside its scroller, and not once it is clipped away",
  async () => {
    const probes = mountProbes();
    try {
      await until(() => probes.seen.near === true);
      await settle();
      assertThat(probes.seen).isEqualTo({ near: true, far: false });
      probes.host.scrollTop = 400;
      await until(() => probes.seen.far === true);
      await until(() => probes.seen.near === false);
    } finally {
      probes.unmount();
    }
  },
);

suite.test(
  "an element in a dock panel that is not showing is not on screen, however it is placed",
  async () => {
    const probes = mountProbes(false);
    try {
      await settle();
      assertThat(probes.seen).isEqualTo({ near: false, far: false });
      probes.render(true);
      await until(() => probes.seen.near === true);
      probes.render(false);
      await until(() => probes.seen.near === false);
    } finally {
      probes.unmount();
    }
  },
);

suite.test(
  "an element is on screen once the browser has said so, and not before",
  async () => {
    const probes = mountProbes();
    try {
      // The first render, before any report, has not seen it yet: a canvas that is not on screen
      // must not be painted for the want of an answer.
      assertThat(probes.seen.near).isEqualTo(false);
      await until(() => probes.seen.near === true);
    } finally {
      probes.unmount();
    }
  },
);
