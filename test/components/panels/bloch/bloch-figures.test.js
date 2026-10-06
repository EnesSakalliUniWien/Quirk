import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Suite, assertThat } from "../../../TestUtil.js";
import { BlochFigures } from "../../../../src/components/panels/bloch/bloch-figures.jsx";
import { panelReadout } from "../../../../src/components/panels/bloch/analyzerModel.js";

const suite = new Suite("BlochFigures");

suite.test(
  "canvas names describe general, polar, mixed and absent states in any camera view",
  () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const names = (readout) => {
      flushSync(() =>
        root.render(
          createElement(BlochFigures, {
            sphereRef: { current: null },
            meridianRef: { current: null },
            equatorRef: { current: null },
            readout,
            rotated: false,
            onResetView: () => {},
            onPointerDown: () => {},
            onPointerMove: () => {},
            onKeyDown: () => {},
          }),
        ),
      );
      return [...host.querySelectorAll("canvas")].map((canvas) =>
        canvas.getAttribute("aria-label"),
      );
    };
    try {
      const general = names(panelReadout({ x: 1, y: 0, z: 0 }));
      assertThat(general[0].includes("θ 90.0°, ϕ 0.0°, |r| 1.000")).isEqualTo(
        true,
      );
      assertThat(general[0].includes("seen from above")).isEqualTo(false);
      for (const z of [-1, 1]) {
        const polar = names(panelReadout({ x: 0, y: 0, z }));
        assertThat(
          polar.every((name) => name.includes("ϕ is undefined on the z axis")),
        ).isEqualTo(true);
        assertThat(polar[2].includes("projects to the center")).isEqualTo(true);
      }
      const mixed = names(panelReadout({ x: 0, y: 0, z: 0 }));
      assertThat(
        mixed.every(
          (name) =>
            name.includes("maximally mixed state") &&
            name.includes("no Bloch direction"),
        ),
      ).isEqualTo(true);
      assertThat(mixed.every((name) => !name.includes("the arrow"))).isEqualTo(
        true,
      );
      for (const readout of [null, undefined]) {
        assertThat(
          names(readout).every((name) => name.includes("no state")),
        ).isEqualTo(true);
      }
    } finally {
      flushSync(() => root.unmount());
    }
  },
);
