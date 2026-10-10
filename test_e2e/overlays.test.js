/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// The panels the circuit and the toolbar open: export, gate forge, gate parameter, Bloch.

import assert from "node:assert/strict";
import {
  circuitMetrics,
  test,
  withQuirkPage,
  waitForCircuit,
  waitForPanel,
  closePanel,
  TEST_TIMEOUT_MILLIS,
  circuitTopForWires,
  waitForCanvasViewport,
  currentCircuit,
  exportedCircuit,
} from "./harness.js";
import { Matrix } from "../src/engine/math/matrix/Matrix.js";

test("export copy failures stay announced and the same control can retry", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.click("#export-button");
    await page.waitForSelector("#export-link-copy-button");
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new DOMException("Write denied", "NotAllowedError");
      };
    });
    await page.click("#export-link-copy-button");
    await page.waitForSelector(".app-toast-description");
    const failure = await page.$eval(
      ".app-toast",
      (element) => element.textContent,
    );
    assert.match(failure, /copy|clipboard/i);
    assert.equal(
      await page.$eval(".app-toasts", (element) =>
        element.getAttribute("aria-live"),
      ),
      "polite",
    );
    await new Promise((resolve) => setTimeout(resolve, 1250));
    assert.equal(
      await page.$eval(".app-toast", (element) => element.textContent),
      failure,
    );
    assert.equal(
      await page.$eval(
        "#export-link-copy-button",
        (element) => element.disabled,
      ),
      false,
    );

    await page.evaluate(() => {
      navigator.clipboard.writeText = async (text) => {
        window.copiedExport = text;
      };
    });
    await page.click("#export-link-copy-button");
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".app-toast-title")].some((e) =>
        /copied/i.test(e.textContent),
      ),
    );
    assert.match(await page.evaluate(() => window.copiedExport), /#circuit=/);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      });
    });
    await page.click("#export-link-copy-button");
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".app-toast-description")].some((e) =>
        /unavailable/i.test(e.textContent),
      ),
    );
    assert.ok(
      await page.$("#export-escaped-anchor"),
      "The selectable circuit link remains available.",
    );
    assert.equal(
      await page.$eval(
        "#export-link-copy-button",
        (element) => element.disabled,
      ),
      false,
    );
    assert.deepEqual(await currentCircuit(page), { cols: [["H"]] });
  });
});

test("export copy captures one request and announces completion after the panel closes", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.click("#export-button");
    await page.waitForSelector("#export-json-copy-button");
    await page.evaluate(() => {
      window.exportWrites = [];
      navigator.clipboard.writeText = (text) => {
        window.exportWrites.push(text);
        return new Promise((resolve) => {
          window.finishExportCopy = resolve;
        });
      };
      const button = document.getElementById("export-json-copy-button");
      button.click();
      button.click();
    });
    await page.waitForFunction(
      () => document.getElementById("export-json-copy-button").disabled,
    );
    assert.equal(await page.evaluate(() => window.exportWrites.length), 1);
    await closePanel(page, "export");
    await page.evaluate(() => window.finishExportCopy());
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".app-toast-title")].some((e) =>
        /copied/i.test(e.textContent),
      ),
    );
    assert.deepEqual(
      JSON.parse(await page.evaluate(() => window.exportWrites[0])),
      { cols: [["H"]] },
    );
  });
});

test("parameter chooser owns focus and Escape returns to its opener", async (browser) => {
  const circuit = { cols: [[{ id: "Rx", arg: "pi/2" }]] };
  await withQuirkPage(browser, circuit, async (page) => {
    await page.focus("#gate-parameter-button");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".parameter-targets button");
    await page.waitForFunction(
      () =>
        document.activeElement ===
        document.querySelector(".parameter-targets button"),
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    await page.keyboard.press("Escape");
    await waitForPanel(page, "gate-param", false);
    await page.waitForFunction(
      () => document.activeElement?.id === "gate-parameter-button",
    );
    await page.keyboard.press("Enter");
    await page.waitForSelector(".parameter-targets button");
    await page.waitForFunction(
      () =>
        document.activeElement ===
        document.querySelector(".parameter-targets button"),
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    await page.keyboard.press("Enter");
    await page.waitForSelector("#gate-param-input");
    await page.keyboard.press("Escape");
    await waitForPanel(page, "gate-param", false);
    await page.waitForFunction(
      () => document.activeElement?.id === "gate-parameter-button",
    );
    assert.deepEqual(await currentCircuit(page), circuit);
  });
});

test("empty parameter chooser explains the next step and hands focus to gate search", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.click("#gate-parameter-button");
    await waitForPanel(page, "gate-param", true);
    const text = await page.$eval(
      ".gate-param-panel",
      (element) => element.innerText,
    );
    assert.match(text, /No editable parameters yet/);
    assert.doesNotMatch(text, /Choose a gate to edit/);
    await page.waitForFunction(
      () => document.activeElement?.id === "gate-param-find-button",
    );
    // Focus alone can succeed inside a clipped floating panel. Wait for its layout pass too.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const emptyLayout = await page.$eval(".gate-param-panel", (panel) => {
      const bounds = panel.getBoundingClientRect();
      const action = panel
        .querySelector("#gate-param-find-button")
        .getBoundingClientRect();
      const close = panel
        .querySelector("footer button")
        .getBoundingClientRect();
      return {
        height: bounds.height,
        actionVisible:
          action.top >= bounds.top && action.bottom <= bounds.bottom,
        closeVisible: close.top >= bounds.top && close.bottom <= bounds.bottom,
      };
    });
    assert.ok(
      emptyLayout.height >= 150 &&
        emptyLayout.actionVisible &&
        emptyLayout.closeVisible,
      JSON.stringify(emptyLayout),
    );
    await page.keyboard.press("Enter");
    await waitForPanel(page, "gate-param", false);
    await page.waitForFunction(
      () => document.activeElement?.id === "gate-search",
    );
    await page.keyboard.type("rotation");
    await page.waitForSelector('.gate-tile[data-gate-id="Rx"]:not([hidden])');
    assert.deepEqual(await currentCircuit(page), { cols: [["H"]] });
  });
});

test("starter examples teach small experiments and remain undoable", async (browser) => {
  const initial = { cols: [["X"]] };
  const starters = [
    ["Superposition", "|00⟩ 50.0%, |01⟩ 50.0%"],
    ["Interference", "|00⟩ 100%"],
    ["Bell Pair", "|00⟩ 50.0%, |11⟩ 50.0%"],
  ];
  await withQuirkPage(browser, initial, async (page) => {
    for (const [name, output] of starters) {
      await page.click("#examples-button");
      await page.waitForSelector('.app-menu[aria-label="Example circuits"]');
      const content = await page.$eval(
        '.app-menu[aria-label="Example circuits"]',
        (element) => element.innerText,
      );
      assert.match(content, /Start here/);
      assert.match(content, /Explore further/);
      assert.match(content, /Grover Search/);
      const item = await page.waitForSelector(
        `.app-menu [role="menuitem"][aria-label="${name}"]`,
      );
      assert.ok(
        (
          await item.$eval(
            ".example-menu-goal",
            (element) => element.textContent,
          )
        ).length > 15,
      );
      await item.click();
      await page.waitForFunction(
        (expected) =>
          document
            .getElementById("circuit-output")
            ?.textContent.includes(expected),
        { timeout: TEST_TIMEOUT_MILLIS },
        output,
      );
      assert.ok((await currentCircuit(page)).cols.length <= 6);
      await page.click("#undo-button");
      await waitForCircuit(page, initial);
    }
  });
});

test("density cell inspection supports keyboard selection without editing the circuit", async (browser) => {
  const circuit = { cols: [["H"], ["Density"]] };
  await withQuirkPage(browser, circuit, async (page) => {
    await waitForCanvasViewport(page);
    const top = await circuitTopForWires(page, 2);
    const bounds = await page.$eval("#drawCanvas canvas", (e) =>
      e.getBoundingClientRect().toJSON(),
    );
    await page.mouse.click(
      bounds.x +
        circuitMetrics.columnSpacing +
        circuitMetrics.firstColumnLeft +
        10,
      bounds.y + top + circuitMetrics.wireSpacing / 2,
    );
    await waitForPanel(page, "complex-display", true);
    await page.waitForSelector(".complex-display-grid");
    await page.focus(".complex-display-grid");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() =>
      document
        .querySelector(".complex-display-grid")
        .getAttribute("aria-label")
        .includes("column 1"),
    );
    const text = await page.$eval(".complex-display-panel", (e) => e.innerText);
    assert.match(text, /Stored complex value/);
    assert.match(text, /0\.5 \+ 0i/);
    assert.match(text, /logarithmic scale/);
    assert.deepEqual(await currentCircuit(page), circuit);
    await closePanel(page, "complex-display");
  });
});

async function openBlochAt(page, column) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await waitForCanvasViewport(page);
    const top = await circuitTopForWires(page, 2);
    const bounds = await page.$eval("#drawCanvas canvas", (e) =>
      e.getBoundingClientRect().toJSON(),
    );
    await page.mouse.click(
      bounds.x +
        column * circuitMetrics.columnSpacing +
        circuitMetrics.firstColumnLeft +
        circuitMetrics.gateSize / 2,
      bounds.y + top + circuitMetrics.wireSpacing / 2,
    );
    if (
      await page
        .waitForSelector("#bloch-x", { visible: true, timeout: 2000 })
        .then(
          () => true,
          () => false,
        )
    )
      break;
  }
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".bloch-strip-step").length > 0 &&
      document.getElementById("bloch-x")?.textContent !== "n/a",
  );
}

test("Bloch Planes draws equatorial triangles independently and explains cos · sin", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"], ["Z^¼"], ["Bloch"]] },
    async (page) => {
      await openBlochAt(page, 2);
      const checks = await page.$$(".bloch-check");
      // Use the visible checkbox, not Base UI's hidden input carrying the supplied id.
      await checks[0].click();
      assert.equal(
        await checks[0].evaluate((e) => e.getAttribute("aria-checked")),
        "false",
      );
      const settle = () =>
        page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
            ),
        );
      await settle();
      const before = await page.$eval("#bloch-canvas", (e) => e.toDataURL());
      await checks[1].click();
      await page.waitForFunction(
        (image) =>
          document.getElementById("bloch-canvas").toDataURL() !== image,
        {},
        before,
      );
      assert.equal(
        await checks[1].evaluate((e) => e.getAttribute("aria-checked")),
        "true",
      );
      await checks[1].click();
      await page.waitForFunction(
        (image) =>
          document.getElementById("bloch-canvas").toDataURL() === image,
        {},
        before,
      );
      // Off, cos · sin says nothing; on, it explains where its labels go.
      assert.equal(
        await checks[6].evaluate((e) => e.getAttribute("aria-describedby")),
        null,
      );
      const projection = await page.$eval("#bloch-equator-canvas", (e) =>
        e.toDataURL(),
      );
      await checks[6].click();
      await page.waitForFunction(
        (image) =>
          document.getElementById("bloch-equator-canvas").toDataURL() !== image,
        {},
        projection,
      );
      assert.match(
        await checks[6].evaluate(
          (e) =>
            document.getElementById(e.getAttribute("aria-describedby"))
              .textContent,
        ),
        /labels the sphere only with Components on/,
      );
      assert.equal(
        await checks[0].evaluate((e) => e.getAttribute("aria-checked")),
        "false",
      );
    },
  );
});

test("Bloch Shadow draws the state's shadow and leaves the sphere as it was when switched off", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"], ["Z^¼"], ["Bloch"]] },
    async (page) => {
      await openBlochAt(page, 2);
      const checks = await page.$$(".bloch-check");
      assert.equal(
        await checks[7].evaluate((e) => e.getAttribute("aria-checked")),
        "false",
      );
      const settle = () =>
        page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
            ),
        );
      await settle();
      const before = await page.$eval("#bloch-canvas", (e) => e.toDataURL());
      await checks[7].click();
      await page.waitForFunction(
        (image) =>
          document.getElementById("bloch-canvas").toDataURL() !== image,
        {},
        before,
      );
      assert.equal(
        await checks[7].evaluate((e) => e.getAttribute("aria-checked")),
        "true",
      );
      await checks[7].click();
      await page.waitForFunction(
        (image) =>
          document.getElementById("bloch-canvas").toDataURL() === image,
        {},
        before,
      );
    },
  );
});

test("Bloch steps keep impossible postselection unavailable without losing earlier states", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["Bloch"], ["|1⟩⟨1|"]] },
    async (page) => {
      await openBlochAt(page, 0);
      assert.equal(
        await page.$eval("#bloch-z", (e) => e.textContent),
        "+1.000",
      );
      assert.equal(
        await page.$$eval(".bloch-strip-step", (buttons) => buttons.length),
        3,
      );
      await page.$$eval(".bloch-strip-step", (buttons) => buttons[2].click());
      await page.waitForFunction(
        () => document.getElementById("bloch-z")?.textContent === "n/a",
      );
      assert.equal(
        await page.$eval("#bloch-tr-rho2", (e) => e.textContent),
        "n/a",
      );
      await page.$$eval(".bloch-strip-step", (buttons) => buttons[0].click());
      await page.waitForFunction(
        () => document.getElementById("bloch-z")?.textContent === "+1.000",
      );
      assert.equal(
        await page.$eval("#bloch-tr-rho2", (e) => e.textContent),
        "1.000",
      );
    },
  );
});

test("Bloch steps preserve deferred measurement across display columns", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"], ["Measure"], ["Bloch"], ["X"]] },
    async (page) => {
      await openBlochAt(page, 2);
      await page.$$eval(".bloch-strip-step", (buttons) => buttons[3].click());
      await page.waitForFunction(() =>
        document
          .getElementById("bloch-subtitle")
          .textContent.includes("after column 3"),
      );
      assert.equal(
        await page.$eval("#bloch-x", (e) => e.textContent),
        "+0.000",
      );
      assert.equal(
        await page.$eval("#bloch-tr-rho2", (e) => e.textContent),
        "0.500",
      );
      await page.$$eval(".bloch-strip-step", (buttons) => buttons[1].click());
      await page.waitForFunction(
        () => document.getElementById("bloch-x").textContent === "+1.000",
      );
    },
  );
});

test("Bloch source selection cancels an unfinished preset transition", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], ["Bloch"]] }, async (page) => {
    await openBlochAt(page, 1);
    for (const returnToCircuit of [true, false]) {
      await page.$eval("#bloch-preset-1", (button) => button.click());
      await page.waitForSelector("#bloch-back-to-circuit");
      await page.evaluate((returnToCircuit) => {
        if (returnToCircuit)
          document.getElementById("bloch-back-to-circuit").click();
        else document.querySelector(".bloch-strip-step").click();
      }, returnToCircuit);
      // Past the preset's duration, no remaining animation may replace the new source.
      await new Promise((resolve) => setTimeout(resolve, 400));
      assert.equal(
        await page.$eval("#bloch-subtitle", (e) => e.textContent),
        returnToCircuit
          ? "q0 · at its Bloch gate, column 2"
          : "q0 · before the first column",
      );
      assert.equal(
        await page.$eval(
          returnToCircuit ? "#bloch-x" : "#bloch-z",
          (e) => e.textContent,
        ),
        "+1.000",
      );
    }
  });
});

test("Bloch sphere keeps state controls before narrow projections and unbroken complex amplitudes", async (browser) => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 390, height: 844, hasTouch: true },
    { width: 320, height: 740, hasTouch: true },
  ]) {
    await withQuirkPage(
      browser,
      { cols: [["H"], ["Z^¼"], ["X^¼"], ["Bloch"]] },
      async (page) => {
        // Keyboard navigation reaches the fourth column even outside a narrow circuit viewport.
        await page.focus("#canvasDiv");
        await page.keyboard.press("Home");
        for (let column = 0; column < 3; column++)
          await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Enter");
        await page.waitForFunction(
          () =>
            document.querySelector("#bloch-beta")?.textContent ===
            "+0.408+0.289i",
        );
        const layout = await page.$eval('[data-panel-id="bloch"]', (panel) => {
          const bounds = panel.getBoundingClientRect();
          const presets = panel
            .querySelector(".bloch-presets")
            .getBoundingClientRect();
          const figure = panel
            .querySelector("#bloch-canvas")
            .getBoundingClientRect();
          const source = panel.querySelector(".bloch-area-source");
          const sourceBounds = source.getBoundingClientRect();
          const meridian = panel.querySelector("#bloch-meridian-canvas");
          const beta = panel.querySelector("#bloch-beta");
          const range = document.createRange();
          range.selectNodeContents(beta);
          return {
            right: bounds.right,
            bottom: bounds.bottom,
            sphereVisible:
              figure.top >= bounds.top && figure.bottom <= bounds.bottom,
            presetsVisible:
              presets.top >= bounds.top && presets.bottom <= bounds.bottom,
            overflow: panel.scrollWidth - panel.clientWidth,
            sourceTop: sourceBounds.top,
            sourceBottom: sourceBounds.bottom,
            sphereBottom: figure.bottom,
            meridianTop: meridian.getBoundingClientRect().top,
            sourceBeforeProjections: Boolean(
              source.compareDocumentPosition(meridian) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            ),
            beta: beta.textContent,
            betaLines: range.getClientRects().length,
            views: [
              ...panel.querySelectorAll(
                "#bloch-canvas, #bloch-meridian-canvas, #bloch-equator-canvas",
              ),
            ].map((canvas) => {
              const rect = canvas.getBoundingClientRect();
              return {
                width: rect.width,
                height: rect.height,
                name: canvas.getAttribute("aria-label"),
              };
            }),
          };
        });
        assert.ok(layout.right <= viewport.width, JSON.stringify(layout));
        assert.ok(layout.bottom <= viewport.height, JSON.stringify(layout));
        if (viewport.width >= 390) {
          assert.ok(layout.sphereVisible, JSON.stringify(layout));
        } else {
          // At 320px with touch targets the app toolbar leaves only 326px of panel height.
          // Keep the sphere legible and let the panel scroll it fully into view.
          await page.$eval("#bloch-canvas", (e) =>
            e.scrollIntoView({ block: "center" }),
          );
          assert.ok(
            await page.$eval("#bloch-canvas", (e) => {
              const sphere = e.getBoundingClientRect();
              const panel = e
                .closest('[data-panel-id="bloch"]')
                .getBoundingClientRect();
              return sphere.top >= panel.top && sphere.bottom <= panel.bottom;
            }),
          );
        }
        assert.equal(layout.overflow, 0);
        assert.equal(layout.views.length, 3);
        assert.ok(layout.sourceBeforeProjections, JSON.stringify(layout));
        if (viewport.width <= 390) {
          assert.ok(
            layout.sourceTop >= layout.sphereBottom &&
              layout.sourceTop - layout.sphereBottom <= 32 &&
              layout.sourceBottom < layout.meridianTop,
            `State controls must follow the sphere before either projection: ${JSON.stringify(
              layout,
            )}`,
          );
        }
        assert.match(layout.views[0].name, /Bloch sphere:/);
        assert.match(layout.views[1].name, /Meridian,/);
        assert.match(layout.views[2].name, /Equator,/);
        for (const view of layout.views) {
          assert.ok(
            Math.abs(view.width - view.height) < 1,
            JSON.stringify(layout.views),
          );
        }
        if (viewport.width >= 1280) {
          assert.ok(
            layout.views[0].width > layout.views[1].width * 1.5,
            JSON.stringify(layout.views),
          );
          assert.ok(layout.presetsVisible, JSON.stringify(layout));
        }
        assert.equal(layout.beta, "+0.408+0.289i");
        assert.equal(
          layout.betaLines,
          1,
          "The imaginary unit must stay with its complex amplitude.",
        );
        // Controls remain actionable after scrolling on narrow panels.
        await page.click("#bloch-preset-mixed");
        await page.waitForFunction(
          () => document.querySelector("#bloch-purity").textContent === "0.000",
        );
        assert.match(
          await page.$eval("#bloch-canvas", (e) =>
            e.getAttribute("aria-label"),
          ),
          /no Bloch direction/,
        );
      },
      viewport,
    );
  }
});

test("composing Enter and Escape leave Bloch entry and gate search intact", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], ["Bloch"]] }, async (page) => {
    await page.focus("#gate-search");
    await page.keyboard.type("Had");
    await page.$eval("#gate-search", (input) =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    assert.equal(
      await page.$eval("#gate-search", (input) => input.value),
      "Had",
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.$eval("#gate-search", (input) => input.value), "");
    await openBlochAt(page, 1);
    await page.focus("#bloch-theta-input");
    const composing = await page.$eval("#bloch-theta-input", (input) => {
      let blurs = 0;
      input.addEventListener("blur", () => blurs++);
      for (const key of ["Enter", "Escape"])
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            isComposing: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      return { blurs, focused: document.activeElement === input };
    });
    assert.deepEqual(composing, { blurs: 0, focused: true });
    await waitForPanel(page, "bloch", true);
    await page.keyboard.press("Enter");
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      "bloch-theta-input",
    );
    await page.keyboard.press("Escape");
    await waitForPanel(page, "bloch", false);
  });
});

test("Bloch sliders show an unfilled track at zero", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], ["Bloch"]] }, async (page) => {
    await openBlochAt(page, 1);
    const tracks = await page.$$eval(".bloch-slider-track", (elements) =>
      elements.map((e) => ({
        track: getComputedStyle(e).backgroundColor,
        background: getComputedStyle(e.closest(".panel-section"))
          .backgroundColor,
      })),
    );
    for (const colors of tracks)
      assert.notEqual(colors.track, colors.background);
  });
});

test("closing the Bloch panel releases its figures' render surfaces", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], ["Bloch"]] }, async (page) => {
    // Each surface listens for pointer moves on the whole document, and holds a WebGL context
    // beside it. Left behind, a few openings cost the circuit its own context.
    const session = await page.createCDPSession();
    const pointerMoveListeners = async () => {
      const { result } = await session.send("Runtime.evaluate", {
        expression: "document",
      });
      const { listeners } = await session.send(
        "DOMDebugger.getEventListeners",
        { objectId: result.objectId },
      );
      await session.send("Runtime.releaseObject", {
        objectId: result.objectId,
      });
      return listeners.filter((listener) => listener.type === "pointermove")
        .length;
    };
    const settled = async (expected) => {
      const deadline = Date.now() + TEST_TIMEOUT_MILLIS;
      let count = await pointerMoveListeners();
      while (count !== expected && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        count = await pointerMoveListeners();
      }
      return count;
    };
    const closed = await pointerMoveListeners();
    await openBlochAt(page, 1);
    assert.ok(
      (await pointerMoveListeners()) > closed,
      "The open figures must hold surfaces to release.",
    );
    for (let opening = 0; opening < 3; opening++) {
      if (opening > 0) await openBlochAt(page, 1);
      await closePanel(page, "bloch");
      assert.equal(await settled(closed), closed);
    }
  });
});

test("opens a Bloch sphere from its enlarged edge at different zoom levels", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], ["Bloch"]] }, async (page) => {
    for (const [button, zoom] of [
      ["Zoom out", 0.8],
      ["Zoom in", 1.25],
    ]) {
      await page.click('[aria-label="Reset zoom"]');
      await page.click(`[aria-label="${button}"]`);
      // Zoom preserves the viewport centre and can scroll the first columns out of view.
      await page.$eval("#canvasDiv", (element) =>
        element.scrollTo({ left: 0, top: 0, behavior: "instant" }),
      );
      // The scene's camera follows the scroll on a throttled redraw; clicking before it lands
      // hits the scene where the zoom had scrolled it.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
          ),
      );
      await waitForCanvasViewport(page);
      const top = await circuitTopForWires(page, 2, zoom);
      const canvas = await page.$eval("#drawCanvas canvas", (element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      });
      // This point is inside the enlarged sphere but outside the ordinary gate rectangle.
      const x =
        circuitMetrics.firstColumnLeft +
        circuitMetrics.columnSpacing +
        circuitMetrics.gateSize / 2 +
        circuitMetrics.blochRadius * 0.9;
      await page.mouse.click(
        canvas.x + x * zoom,
        canvas.y + (top + circuitMetrics.wireSpacing / 2) * zoom,
      );
      await waitForPanel(page, "bloch", true);
      await closePanel(page, "bloch");
    }
  });
});

test("opens and closes the export and gate forge panels", async (browser) => {
  const circuit = { cols: [["H"]] };
  await withQuirkPage(browser, circuit, async (page) => {
    await page.click("#export-button");
    // An open panel never disables the app: the rest of the chrome keeps working around it.
    assert.equal(
      await page.$eval("#gate-forge-button", (button) => button.disabled),
      false,
    );
    await waitForPanel(page, "export", true);
    const jsonText = await page.$eval(
      "#export-circuit-json-pre",
      (element) => element.textContent,
    );
    assert.deepEqual(JSON.parse(jsonText), circuit);
    // The offline-copy quine is gone; the panel must not offer the download any more.
    assert.equal(await page.$("#download-offline-copy-button"), null);
    await closePanel(page, "export");

    await page.click("#gate-forge-button");
    await waitForPanel(page, "forge", true);
    const forge = await page.$eval(".forge-panel", (element) => ({
      title: element.querySelector(".panel-title")?.textContent,
      methodCount: element.querySelectorAll(".forge-method").length,
    }));
    assert.equal(forge.title, "Create gate");
    assert.equal(forge.methodCount, 1);
    assert.equal(
      await page.$$eval(
        '.construction-tabs [role="tab"]',
        (tabs) => tabs.length,
      ),
      3,
    );
    await closePanel(page, "forge");
  });
});

/**
 * The amber the playhead band paints across one column, counted over the strip between the two
 * wire rows. Gate boxes stop at the rows, so that strip is band or background and nothing else.
 */

test("edits a rotation gate angle through the parameter dialog", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [[{ id: "Rx", arg: "pi/2" }]] },
    async (page) => {
      const canvasBounds = await page.$eval("#drawCanvas canvas", (element) => {
        const bounds = element.getBoundingClientRect();
        return { x: bounds.x, y: bounds.y };
      });

      // The change button is the bottom half of the gate in the first column on the first wire.
      // The state table fills in asynchronously and can shift the centered circuit between the
      // position sample and the click, so retry until the dialog actually opens.
      let opened = false;
      for (let attempt = 0; attempt < 3 && !opened; attempt++) {
        await waitForCanvasViewport(page);
        const circuitTop = await circuitTopForWires(page, 2);
        await page.mouse.move(
          canvasBounds.x +
            circuitMetrics.firstColumnLeft +
            circuitMetrics.gateSize / 2,
          canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2 + 13,
        );
        await page.mouse.down();
        await page.mouse.up();
        opened = await page
          .waitForSelector('[data-panel-id="gate-param"]', {
            visible: true,
            timeout: 2000,
          })
          .then(
            () => true,
            () => false,
          );
      }
      assert.ok(opened, "The parameter panel must open.");
      await page.waitForFunction(
        () => document.activeElement?.id === "gate-param-input",
        { timeout: TEST_TIMEOUT_MILLIS },
      );

      // Focusing selects the current value, so typing replaces it; Enter applies.
      await page.keyboard.type("3pi/4");
      await page.keyboard.press("Enter");
      await waitForPanel(page, "gate-param", false);
      await waitForCircuit(page, { cols: [[{ id: "Rx", arg: "3pi/4" }]] });
    },
  );
});

test("opens the enlarged Bloch sphere view from a Bloch display gate", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], ["Bloch"]] }, async (page) => {
    const canvasBounds = await page.$eval("#drawCanvas canvas", (element) => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y };
    });

    // The Bloch display gate sits in the second column on the first wire. Retried for the
    // same layout-shift race the parameter dialog test guards against.
    let opened = false;
    for (let attempt = 0; attempt < 3 && !opened; attempt++) {
      await waitForCanvasViewport(page);
      const circuitTop = await circuitTopForWires(page, 2);
      await page.mouse.click(
        canvasBounds.x +
          circuitMetrics.columnSpacing +
          circuitMetrics.firstColumnLeft +
          circuitMetrics.gateSize / 2,
        canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2,
      );
      opened = await page
        .waitForSelector('[data-panel-id="bloch"]', {
          visible: true,
          timeout: 2000,
        })
        .then(
          () => true,
          () => false,
        );
    }
    assert.ok(opened, "The Bloch sphere panel must open.");
    await page.waitForFunction(
      () =>
        document.getElementById("bloch-subtitle").textContent !== "" &&
        document.getElementById("bloch-x").textContent !== "n/a",
      { timeout: TEST_TIMEOUT_MILLIS },
    );

    // After the Hadamard the qubit is |+⟩: on the +x axis, pure, at θ 90°.
    const readout = await page.evaluate(() => ({
      subtitle: document.getElementById("bloch-subtitle").textContent,
      x: document.getElementById("bloch-x").textContent,
      z: document.getElementById("bloch-z").textContent,
      theta: document.getElementById("bloch-theta").textContent,
      purity: document.getElementById("bloch-purity").textContent,
      quaternion: document.getElementById("bloch-quaternion").textContent,
      vector: document.getElementById("bloch-vector-quaternion").textContent,
    }));
    assert.equal(readout.subtitle, "q0 · at its Bloch gate, column 2");
    assert.equal(readout.x, "+1.000");
    assert.equal(readout.z, "+0.000");
    assert.equal(readout.theta, "90.0°");
    assert.equal(readout.purity, "1.000");
    // |+⟩ is |0⟩ turned a quarter turn about +y: q = cos 45° + sin 45° j, and q k q̄ = i.
    assert.equal(readout.quaternion, "0.707 +0.000i +0.707j +0.000k");
    assert.equal(readout.vector, "+1.000i +0.000j +0.000k");

    // Sample the visible canvases between browser frames throughout layout changes and rotation.
    await page.waitForFunction(() => {
      const canvas = document.getElementById("bloch-canvas");
      return canvas.getContext("2d").getImageData(1, 1, 1, 1).data[3] > 0;
    });
    await page.evaluate(() => {
      const copy = document.createElement("canvas");
      copy.width = copy.height = 1;
      const ctx = copy.getContext("2d", { willReadFrequently: true });
      const samples = {
        drawCanvas: { frames: 0, blank: 0 },
        "bloch-canvas": { frames: 0, blank: 0 },
      };
      let active = true;
      const sample = () => {
        if (!active) return;
        for (const [id, counts] of Object.entries(samples)) {
          const canvas =
            id === "drawCanvas"
              ? document.querySelector("#drawCanvas canvas")
              : document.getElementById(id);
          ctx.clearRect(0, 0, 1, 1);
          ctx.drawImage(canvas, 1, 1, 1, 1, 0, 0, 1, 1);
          counts.frames++;
          if (ctx.getImageData(0, 0, 1, 1).data[3] === 0) counts.blank++;
        }
        requestAnimationFrame(sample);
      };
      window.stopCanvasSampling = () => {
        active = false;
        return samples;
      };
      requestAnimationFrame(sample);
    });
    for (const deviceScaleFactor of [1, 2]) {
      for (const width of [1180, 1300, 1200]) {
        await page.setViewport({ width, height: 760, deviceScaleFactor });
        await waitForCanvasViewport(page);
      }
      const sphere = await page.$eval("#bloch-canvas", (canvas) => {
        const r = canvas.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.mouse.move(sphere.x, sphere.y);
      await page.mouse.down();
      await page.mouse.move(sphere.x + 70, sphere.y + 35, { steps: 15 });
      await page.mouse.up();
    }
    const samples = await page.evaluate(() => window.stopCanvasSampling());
    for (const [id, counts] of Object.entries(samples)) {
      assert.ok(counts.frames > 0, `${id} must be sampled during interaction`);
      assert.equal(
        counts.blank,
        0,
        `${id} must keep its previous frame until the next render`,
      );
    }

    await closePanel(page, "bloch");
  });
});

test("panel controls remain distinct from their surfaces across panels", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    for (const [trigger, panel] of [
      ["export-button", "export"],
      ["gate-forge-button", "forge"],
      ["tape-button", "tape"],
    ]) {
      await page.click(`#${trigger}`);
      await waitForPanel(page, panel, true);
      const appearance = await page.$eval(
        `[data-panel-id="${panel}"]`,
        (root) => {
          const rgb = (color) =>
            color
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number);
          const luminance = (color) =>
            rgb(color)
              .map((value) => {
                const channel = value / 255;
                return channel <= 0.04045
                  ? channel / 12.92
                  : ((channel + 0.055) / 1.055) ** 2.4;
              })
              .reduce(
                (sum, channel, i) =>
                  sum + channel * [0.2126, 0.7152, 0.0722][i],
                0,
              );
          const contrast = (a, b) => {
            const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
            return (values[0] + 0.05) / (values[1] + 0.05);
          };
          const content = document
            .querySelector(`[data-tab-panel-id="${root.dataset.panelId}"]`)
            .closest(".dv-groupview");
          const surface = getComputedStyle(content).backgroundColor;
          return {
            ownTheme: root.closest(".dockview-theme-shadow-quant") !== null,
            stockTheme: root.closest(".dockview-theme-dark") !== null,
            controls: [...root.querySelectorAll("button:not([class])")].map(
              (button) => {
                const style = getComputedStyle(button);
                return {
                  text: contrast(style.color, style.backgroundColor),
                  surface: contrast(style.backgroundColor, surface),
                };
              },
            ),
          };
        },
      );
      assert.equal(appearance.ownTheme, true);
      assert.equal(appearance.stockTheme, false);
      assert.ok(appearance.controls.length > 0);
      for (const control of appearance.controls) {
        assert.ok(control.text >= 4.5, `${panel}: readable button text`);
        assert.ok(
          control.surface >= 1.5,
          `${panel}: button surface distinguishable from panel`,
        );
      }
    }
  });
});

async function chooseConstruction(page, name) {
  await page.$$eval(
    '.construction-tabs [role="tab"]',
    (tabs, name) => tabs.find((tab) => tab.textContent === name).click(),
    name,
  );
}
async function replaceField(page, selector, text) {
  await page.$eval(selector, (element) => {
    element.focus();
    element.select();
  });
  await page.keyboard.press("Backspace");
  await page.type(selector, text);
}
async function namedButton(page, selector, text) {
  await page.$$eval(
    selector,
    (buttons, text) =>
      buttons.find((button) => button.textContent.trim() === text).click(),
    text,
  );
}
async function insertAndReopen(page, created) {
  const id = created.gates[0].id;
  await page.$eval(`[data-gate-id="${id}"]`, (element) => element.focus());
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (id) =>
      JSON.parse(
        document.querySelector("#drawCanvas").dataset.circuit,
      ).cols.some((c) => c.includes(id)),
    {},
    id,
  );
  const inserted = await currentCircuit(page);
  assert.deepEqual(await exportedCircuit(page), inserted);
  await page.click("#undo-button");
  await waitForCircuit(page, created);
  await page.click("#redo-button");
  await waitForCircuit(page, inserted);
  await page.reload();
  await waitForCircuit(page, inserted);
}

test("custom gate windows preserve drafts and fit docked panel widths", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"]] },
    async (page) => {
      await page.click("#gate-forge-button");
      await page.waitForSelector("#gate-forge-rotation-button:not([disabled])");
      await replaceField(page, "#gate-forge-rotation-angle", "60");
      await replaceField(page, "#gate-forge-rotation-name", "Sixty");
      await chooseConstruction(page, "Matrix");
      await namedButton(page, ".entry-modes button", "Raw text");
      await replaceField(page, "#gate-forge-matrix", "invalid");
      await chooseConstruction(page, "Rotation");
      assert.equal(
        await page.$eval("#gate-forge-rotation-angle", (e) => e.value),
        "60",
      );
      assert.equal(
        await page.$eval("#gate-forge-rotation-name", (e) => e.value),
        "Sixty",
      );
      for (const width of [340, 419, 720, 830]) {
        const rect = await page.$eval('[data-panel-id="forge"]', (e) =>
          e.getBoundingClientRect().toJSON(),
        );
        await page.mouse.move(rect.left, rect.top + 80);
        await page.mouse.down();
        await page.mouse.move(rect.right - width, rect.top + 80, { steps: 12 });
        await page.mouse.up();
        await page.waitForFunction(
          (width) =>
            Math.abs(
              document.querySelector('[data-panel-id="forge"]').clientWidth -
                width,
            ) < 3,
          {},
          width,
        );
        const layout = await page.$eval('[data-panel-id="forge"]', (root) => {
          root.querySelector(".construction-scroll").scrollTop = 10000;
          const panel = root.getBoundingClientRect(),
            footer = root
              .querySelector(".construction-actions")
              .getBoundingClientRect();
          return {
            width: root.clientWidth,
            scroll: root.scrollWidth,
            footerInside:
              footer.bottom <= panel.bottom + 1 && footer.top >= panel.top,
          };
        });
        assert.ok(layout.scroll <= layout.width + 1);
        assert.ok(layout.footerInside);
      }
      await chooseConstruction(page, "Matrix");
      assert.equal(
        await page.$eval("#gate-forge-matrix", (e) => e.value),
        "invalid",
      );
      assert.equal(
        await page.$eval("#gate-forge-matrix-button", (e) => e.disabled),
        true,
      );
    },
    { width: 1600, height: 900, deviceScaleFactor: 1 },
  );
});

test("an equality assertion is edited an amplitude at a time, or taken from the state at the gate", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"], ["assert-eq1"]] },
    async (page) => {
      const open = async () => {
        await page.click("#gate-parameter-button");
        await page.waitForSelector(".parameter-targets button");
        await page.click(".parameter-targets button");
        await page.waitForSelector(".amplitudes-editor input");
      };
      const fields = () =>
        page.$$eval(".amplitudes-editor input", (inputs) =>
          inputs.map((input) => input.value),
        );
      const claimed = async () =>
        (await currentCircuit(page)).cols[1][0].arg.flat();
      const near = (actual, expected) =>
        actual.every((value, i) => Math.abs(value - expected[i]) < 1e-6);
      const s = Math.SQRT1_2;

      await open();
      assert.deepEqual(
        await page.$$eval(".amplitudes-editor-ket", (kets) =>
          kets.map((ket) => ket.textContent),
        ),
        ["|0⟩", "|1⟩"],
      );
      assert.deepEqual(await fields(), ["1", "0"]);
      await page.click("#amplitudes-use-state-button");
      await page.waitForFunction(
        () => document.querySelector(".amplitudes-editor input").value !== "1",
      );
      assert.deepEqual(await fields(), ["0.707107", "0.707107"]);
      await page.click("#gate-param-apply-button");
      await waitForPanel(page, "gate-param", false);
      assert.ok(near(await claimed(), [s, 0, s, 0]));

      // Typed formulas are scaled to unit length, and a mistake stays in the editor.
      await open();
      await replaceField(page, '[aria-label="Amplitude of |0⟩"]', "1");
      await replaceField(page, '[aria-label="Amplitude of |1⟩"]', "nonsense");
      await page.click("#gate-param-apply-button");
      await page.waitForSelector("#gate-param-error:not([hidden])");
      await replaceField(page, '[aria-label="Amplitude of |1⟩"]', "-i");
      await page.click("#gate-param-apply-button");
      await waitForPanel(page, "gate-param", false);
      assert.ok(near(await claimed(), [s, 0, 0, -s]));
    },
  );
});

test("parameter validation and typing undo preserve circuit history", async (browser) => {
  const initial = { cols: [[{ id: "Rx", arg: "pi/2" }]] };
  await withQuirkPage(browser, initial, async (page) => {
    const open = async () => {
      await page.click("#gate-parameter-button");
      await page.waitForSelector(".parameter-targets button");
      await page.click(".parameter-targets button");
      await page.waitForSelector("#gate-param-input");
    };
    await open();
    await replaceField(page, "#gate-param-input", "not_an_angle");
    assert.equal(
      await page.$eval("#gate-param-apply-button", (e) => e.disabled),
      true,
    );
    assert.deepEqual(await currentCircuit(page), initial);
    await replaceField(page, "#gate-param-input", "3pi/4");
    await page.keyboard.press("Enter");
    const changed = { cols: [[{ id: "Rx", arg: "3pi/4" }]] };
    await waitForCircuit(page, changed);
    await open();
    await replaceField(page, "#gate-param-input", "pi/8");
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.down(modifier);
    await page.keyboard.press("z");
    await page.keyboard.up(modifier);
    assert.deepEqual(await currentCircuit(page), changed);
    const footer = await page.$eval(
      '[data-panel-id="gate-param"]',
      (root) =>
        root.querySelector(".construction-actions").getBoundingClientRect()
          .bottom <=
        root.getBoundingClientRect().bottom + 1,
    );
    assert.ok(footer);
    await page.click("#gate-param-cancel-button");
    await page.click("#undo-button");
    await waitForCircuit(page, initial);
  });
});

test("matrix creation preserves entered values unless correction is accepted", async (browser) => {
  for (const correct of [false, true])
    await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
      await page.click("#gate-forge-button");
      await chooseConstruction(page, "Matrix");
      await namedButton(page, ".entry-modes button", "Raw text");
      await replaceField(page, "#gate-forge-matrix", "1,i,i,1");
      await replaceField(page, "#gate-forge-matrix-name", "Matrix example");
      await page.waitForSelector("#gate-forge-matrix-button:not([disabled])");
      if (correct) {
        await namedButton(page, ".construction-preview button", "Make unitary");
        await page.waitForSelector(".matrix-correction");
        await namedButton(
          page,
          ".matrix-correction button",
          "Use corrected matrix",
        );
        await page.waitForSelector("#gate-forge-matrix-button:not([disabled])");
      }
      await page.click("#gate-forge-matrix-button");
      await waitForPanel(page, "forge", false);
      const created = await currentCircuit(page);
      assert.equal(created.gates.length, 1);
      const matrix = Matrix.parse(created.gates[0].matrix);
      assert.equal(matrix.isUnitary(0.00001), correct);
      if (!correct) assert.equal(matrix.cell(0, 0).real, 1);
      await page.waitForFunction(
        (id) => document.activeElement?.dataset.gateId === id,
        {},
        created.gates[0].id,
      );
      await page.click("#undo-button");
      await waitForCircuit(page, { cols: [["H"]] });
      await page.click("#redo-button");
      await waitForCircuit(page, created);
      await page.reload();
      await page.waitForSelector(`[data-gate-id="${created.gates[0].id}"]`);
      assert.deepEqual(await currentCircuit(page), created);
      await insertAndReopen(page, created);
    });
});

test("matrix grids keep dimension drafts and invalidate accepted corrections on edits", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.click("#gate-forge-button");
    await chooseConstruction(page, "Matrix");
    await replaceField(
      page,
      '.matrix-input-grid [aria-label="Row 1, column 1"]',
      "2",
    );
    await page.select('[aria-label="Matrix dimension"]', "4");
    await page.waitForSelector("#gate-forge-matrix-button:not([disabled])");
    assert.equal(
      await page.$$eval(".matrix-input-grid input", (es) => es.length),
      16,
    );
    await page.select('[aria-label="Matrix dimension"]', "2");
    assert.equal(
      await page.$eval(
        '.matrix-input-grid [aria-label="Row 1, column 1"]',
        (e) => e.value,
      ),
      "2",
    );
    await page.waitForSelector("#gate-forge-matrix-button:not([disabled])");
    await namedButton(page, ".construction-preview button", "Make unitary");
    await page.waitForSelector(".matrix-correction");
    await namedButton(
      page,
      ".matrix-correction button",
      "Use corrected matrix",
    );
    await replaceField(
      page,
      '.matrix-input-grid [aria-label="Row 1, column 1"]',
      "3",
    );
    await page.waitForSelector("#gate-forge-matrix-button:not([disabled])");
    assert.equal(await page.$(".matrix-correction"), null);
    await replaceField(
      page,
      '.matrix-input-grid [aria-label="Row 1, column 1"]',
      "",
    );
    await page.waitForFunction(
      () => document.querySelector("#gate-forge-matrix-button").disabled,
    );
  });
});

test("circuit construction includes wide trailing gates and clears selection on method changes", async (browser) => {
  // A rotation gate is three columns wide: its box, and the dial beside it.
  const initial = {
    cols: [[{ id: "Ry", arg: "pi/3" }], [], [], [{ id: "Rz", arg: "pi/4" }]],
  };
  await withQuirkPage(browser, initial, async (page) => {
    await page.click("#gate-forge-button");
    await chooseConstruction(page, "Circuit");
    await page.waitForSelector("#gate-forge-circuit-button:not([disabled])");
    await page.waitForSelector(".forge-range-highlight");
    for (const [zoom, buttons] of [
      [0.8, ["Zoom out"]],
      [1, []],
      [1.5, ["Zoom in", "Zoom in"]],
    ]) {
      await page.click('[aria-label="Reset zoom"]');
      for (const label of buttons) await page.click(`[aria-label="${label}"]`);
      await page.$eval("#canvasDiv", (e) => e.scrollTo(0, 0));
      await waitForCanvasViewport(page);
      const top = await circuitTopForWires(page, 2, zoom);
      const expected =
        (top +
          circuitMetrics.wireSpacing / 2 -
          circuitMetrics.gateSize / 2 +
          0.5) *
        zoom;
      await page.waitForFunction(
        (expected) => {
          const host = document.querySelector("#canvasDiv"),
            rect = document
              .querySelector(".forge-range-highlight")
              .getBoundingClientRect();
          return (
            Math.abs(
              rect.top -
                host.getBoundingClientRect().top +
                host.scrollTop -
                expected,
            ) < 1
          );
        },
        {},
        expected,
      );
    }
    await replaceField(page, "#gate-forge-circuit-cols", "1:1");
    await page.waitForSelector('#gate-forge-circuit-canvas [role="alert"]');
    assert.match(
      await page.$eval("#gate-forge-circuit-canvas", (e) => e.textContent),
      /whole/,
    );
    assert.equal(await page.$(".forge-range-highlight"), null);
    await replaceField(page, "#gate-forge-circuit-cols", "1:∞");
    await replaceField(page, "#gate-forge-circuit-name", "Whole circuit");
    await page.waitForSelector("#gate-forge-circuit-button:not([disabled])");
    await chooseConstruction(page, "Rotation");
    await page.waitForSelector(".forge-range-highlight", { hidden: true });
    await chooseConstruction(page, "Circuit");
    await page.waitForSelector("#gate-forge-circuit-button:not([disabled])");
    await page.click("#gate-forge-circuit-button");
    await waitForPanel(page, "forge", false);
    const created = await currentCircuit(page);
    assert.equal(created.gates.length, 1);
    assert.deepEqual(created.cols, initial.cols);
    assert.deepEqual(
      created.gates[0].circuit.cols.filter((c) => c.length),
      initial.cols.filter((c) => c.length),
    );
    await insertAndReopen(page, created);
  });
});

test("mathematical entry preserves raw expressions and validates rich edits", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [[{ id: "Ry", arg: "pi/3" }]] },
    async (page) => {
      const requests = [];
      page.on("request", (request) => requests.push(request.url()));
      await page.click("#gate-parameter-button");
      await page.waitForSelector(".parameter-targets button");
      await page.click(".parameter-targets button");
      await namedButton(
        page,
        '[data-panel-id="gate-param"] .math-entry-actions button',
        "Math input",
      );
      await page.waitForSelector("math-field#gate-param-input");
      await namedButton(
        page,
        '[data-panel-id="gate-param"] .math-entry-actions button',
        "Raw expression",
      );
      assert.equal(
        await page.$eval("#gate-param-input", (e) => e.value),
        "pi/3",
      );
      await namedButton(
        page,
        '[data-panel-id="gate-param"] .math-entry-actions button',
        "Math input",
      );
      await page.waitForSelector("math-field#gate-param-input");
      await page.$eval("math-field", (e) => {
        e.setValue(String.raw`\int_0^1 x`, { silenceNotifications: true });
        e.dispatchEvent(new InputEvent("input", { bubbles: true }));
      });
      await page.waitForFunction(
        () => document.querySelector("#gate-param-apply-button").disabled,
      );
      await page.$eval("math-field", (e) => {
        e.setValue(String.raw`\frac{\pi}{4}`, { silenceNotifications: true });
        e.dispatchEvent(new InputEvent("input", { bubbles: true }));
      });
      await page.waitForFunction(
        () => !document.querySelector("#gate-param-apply-button").disabled,
      );
      await namedButton(
        page,
        '[data-panel-id="gate-param"] .math-entry-actions button',
        "Math keyboard",
      );
      await page.waitForFunction(() => window.mathVirtualKeyboard.visible);
      await page.waitForFunction(() => {
        const keyboard = window.mathVirtualKeyboard.boundingRect;
        const scroll = document
          .querySelector(".gate-param-panel .construction-scroll")
          .getBoundingClientRect();
        return keyboard.top >= scroll.top && keyboard.bottom <= scroll.bottom;
      });
      assert.ok(
        await page.$eval(
          '[data-panel-id="gate-param"]',
          (root) =>
            root.querySelector(".construction-actions").getBoundingClientRect()
              .bottom <=
            root.getBoundingClientRect().bottom + 1,
        ),
      );
      await page.focus("math-field");
      await page.keyboard.press("Escape");
      assert.ok(await page.$('[data-panel-id="gate-param"]'));
      await page.click("#gate-param-apply-button");
      await waitForPanel(page, "gate-param", false);
      const saved = await currentCircuit(page);
      assert.match(saved.cols[0][0].arg, /pi/);
      assert.ok(
        requests.every(
          (url) =>
            new URL(url).origin === new URL(page.url()).origin ||
            url.startsWith("data:") ||
            url.startsWith("blob:"),
        ),
        "Rich entry assets must be served locally.",
      );
    },
  );
});

test("failed mathematical input loading retains usable raw entry", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [[{ id: "Ry", arg: "pi/3" }]] },
    async (page) => {
      await page.setRequestInterception(true);
      page.on("request", (request) =>
        /math-live-runtime.*\.js/.test(request.url())
          ? request.abort()
          : request.continue(),
      );
      await page.click("#gate-parameter-button");
      await page.waitForSelector(".parameter-targets button");
      await page.click(".parameter-targets button");
      await namedButton(page, ".math-entry-actions button", "Math input");
      await page.waitForFunction(() =>
        document
          .querySelector(".math-entry")
          .textContent.includes("could not load"),
      );
      assert.equal(
        await page.$eval("#gate-param-input", (e) => e.value),
        "pi/3",
      );
      await replaceField(page, "#gate-param-input", "pi/4");
      await page.click("#gate-param-apply-button");
      await waitForCircuit(page, { cols: [[{ id: "Ry", arg: "pi/4" }]] });
    },
    undefined,
    [/Failed to load resource: net::ERR_FAILED/],
  );
});

test("rotation construction commits the inspected operation and places the new gate", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.click("#gate-forge-button");
    await namedButton(page, ".axis-presets button", "Y");
    await replaceField(page, "#gate-forge-rotation-angle", "60");
    await replaceField(page, "#gate-forge-rotation-name", "Y sixty");
    await page.waitForSelector("#gate-forge-rotation-button:not([disabled])");
    await page.click("#gate-forge-rotation-button");
    await waitForPanel(page, "forge", false);
    const created = await currentCircuit(page),
      matrix = Matrix.parse(created.gates[0].matrix);
    assert.ok(Math.abs(matrix.cell(0, 0).real - Math.sqrt(3) / 2) < 0.00001);
    assert.ok(Math.abs(matrix.cell(0, 1).real - 0.5) < 0.00001);
    await insertAndReopen(page, created);
  });
});

test("parameter units, composition and stale targets preserve the current circuit", async (browser) => {
  const initial = { cols: [[{ id: "Ry", arg: "pi/3" }]] };
  await withQuirkPage(browser, initial, async (page) => {
    const open = async () => {
      await page.click("#gate-parameter-button");
      await page.waitForSelector(".parameter-targets button");
      await page.click(".parameter-targets button");
      await page.waitForSelector("#gate-param-input");
    };
    await open();
    await page.select('[aria-label="Angle unit"]', "degrees");
    assert.ok(
      Math.abs(
        Number(await page.$eval("#gate-param-input", (e) => e.value)) - 60,
      ) < 1e-10,
    );
    await page.select('[aria-label="Angle unit"]', "radians");
    assert.equal(await page.$eval("#gate-param-input", (e) => e.value), "pi/3");
    const prevented = await page.$eval(
      "#gate-param-input",
      (e) =>
        !e.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            isComposing: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
    );
    assert.equal(prevented, true);
    await page.select('[aria-label="Angle unit"]', "degrees");
    await page.click("#gate-param-apply-button");
    await waitForPanel(page, "gate-param", false);
    assert.deepEqual(await currentCircuit(page), initial);
    await open();
    await page.select('[aria-label="Angle unit"]', "degrees");
    await replaceField(page, "#gate-param-input", "90");
    await page.click("#gate-param-apply-button");
    await waitForPanel(page, "gate-param", false);
    assert.ok(
      Math.abs(
        Number((await currentCircuit(page)).cols[0][0].arg) - Math.PI / 2,
      ) < 1e-10,
    );
    await open();
    await replaceField(page, "#gate-param-input", "pi/8");
    await page.click("#undo-button");
    await waitForCircuit(page, initial);
    await page.click("#gate-param-apply-button");
    await waitForPanel(page, "gate-param", false);
    assert.deepEqual(await currentCircuit(page), initial);
  });
});

test("Escape closes the formula help before the parameter window", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [[{ id: "Ry", arg: "pi/3" }]] },
    async (page) => {
      await page.click("#gate-parameter-button");
      await page.waitForSelector(".parameter-targets button");
      await page.click(".parameter-targets button");
      await page.waitForSelector("#gate-param-input");
      await page.click(".formula-help summary");
      assert.equal(
        await page.$eval(".formula-help", (element) => element.open),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.$eval(".formula-help", (element) => element.open),
        false,
      );
      assert.ok(
        await page.$('[data-panel-id="gate-param"]'),
        "The first Escape must leave the window open.",
      );
      await page.keyboard.press("Escape");
      await waitForPanel(page, "gate-param", false);
    },
  );
});

test("creating a gate keeps a toolbox search that shows it and clears one that hides it", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    for (const [search, name, kept] of [
      ["kept", "Kept", true],
      ["fourier", "Cleared", false],
    ]) {
      const before = new Set(
        ((await currentCircuit(page)).gates ?? []).map((gate) => gate.id),
      );
      await replaceField(page, "#gate-search", search);
      await page.click("#gate-forge-button");
      await replaceField(page, "#gate-forge-rotation-name", name);
      await page.waitForSelector("#gate-forge-rotation-button:not([disabled])");
      await page.click("#gate-forge-rotation-button");
      await waitForPanel(page, "forge", false);
      const id = (await currentCircuit(page)).gates
        .map((gate) => gate.id)
        .find((id) => !before.has(id));
      await page.waitForFunction(
        (id) => document.activeElement?.dataset.gateId === id,
        {},
        id,
      );
      assert.equal(
        await page.$eval("#gate-search", (element) => element.value),
        kept ? search : "",
      );
    }
  });
});

test("construction tabs move focus with the arrow keys and activate with Enter or Space", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    const selected = () =>
      page.$eval(
        '.construction-tabs [aria-selected="true"]',
        (tab) => tab.textContent,
      );
    await page.click("#gate-forge-button");
    await page.waitForFunction(
      () => document.activeElement?.getAttribute("role") === "tab",
    );
    assert.equal(await selected(), "Rotation");
    // The selected tab is the list's one tab stop, so the first arrow key already moves.
    assert.deepEqual(
      await page.$$eval('.construction-tabs [role="tab"]', (tabs) =>
        tabs.map((tab) => tab.tabIndex),
      ),
      [0, -1, -1],
    );
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      "Matrix",
    );
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        document.querySelector('.construction-tabs [aria-selected="true"]')
          .textContent === "Matrix",
    );
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press(" ");
    await page.waitForFunction(
      () =>
        document.querySelector('.construction-tabs [aria-selected="true"]')
          .textContent === "Circuit",
    );
    assert.ok(await page.$("#gate-forge-circuit-cols"));
  });
});

test("a renamed draft waits for its own preview and a double submit creates one gate", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.click("#gate-forge-button");
    await page.waitForSelector("#gate-forge-rotation-button:not([disabled])");
    // Rename inside the page, then look before the 100ms debounce can settle.
    const pending = await page.$eval(
      "#gate-forge-rotation-name",
      async (input) => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set.call(input, "Renamed");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        return {
          disabled: document.getElementById("gate-forge-rotation-button")
            .disabled,
          updating: document
            .getElementById("gate-forge-rotation-canvas")
            .textContent.includes("Updating preview"),
        };
      },
    );
    assert.deepEqual(pending, { disabled: true, updating: true });
    await page.waitForSelector("#gate-forge-rotation-button:not([disabled])");
    await page.$eval("#gate-forge-rotation-button", (button) => {
      button.click();
      button.click();
    });
    await waitForPanel(page, "forge", false);
    assert.equal((await currentCircuit(page)).gates.length, 1);
  });
});

test("editing Ry through a keyboard-chosen target moves the Bloch vector to the new angle", async (browser) => {
  // Ry and Rz are each three columns wide, box and dial, so the Bloch display sits in the seventh column.
  const cols = (rotation) => [
    [{ id: "Ry", arg: rotation }],
    [],
    [],
    [{ id: "Rz", arg: "pi/4" }],
    [],
    [],
    ["Bloch"],
  ];
  await withQuirkPage(browser, { cols: cols("pi/3") }, async (page) => {
    const canvasBounds = await page.$eval("#drawCanvas canvas", (element) => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y };
    });
    let opened = false;
    for (let attempt = 0; attempt < 3 && !opened; attempt++) {
      await waitForCanvasViewport(page);
      const circuitTop = await circuitTopForWires(page, 2);
      await page.mouse.click(
        canvasBounds.x +
          6 * circuitMetrics.columnSpacing +
          circuitMetrics.firstColumnLeft +
          circuitMetrics.gateSize / 2,
        canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2,
      );
      opened = await page
        .waitForSelector('[data-panel-id="bloch"]', {
          visible: true,
          timeout: 2000,
        })
        .then(
          () => true,
          () => false,
        );
    }
    assert.ok(opened, "The Bloch sphere panel must open.");
    await page.waitForFunction(
      () => document.getElementById("bloch-theta").textContent === "60.0°",
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    const phi = await page.$eval(
      "#bloch-phi",
      (element) => element.textContent,
    );

    // The toolbar opens the target list; the keyboard chooses Ry, the first parameter gate.
    await page.$eval("#gate-parameter-button", (button) => button.click());
    await page.waitForSelector(".parameter-targets button");
    await page.focus(".parameter-targets button");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#gate-param-input");
    assert.equal(
      await page.$eval("#gate-param-input", (element) => element.value),
      "pi/3",
    );
    await replaceField(page, "#gate-param-input", "pi/2");
    await page.keyboard.press("Enter");
    await waitForCircuit(page, { cols: cols("pi/2") });
    await page.waitForFunction(
      () => document.getElementById("bloch-theta").textContent === "90.0°",
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    assert.equal(
      await page.$eval("#bloch-phi", (element) => element.textContent),
      phi,
    );
  });
});

test("a rotation gate edits from its indicator and not from its body at each zoom step", async (browser) => {
  const circuit = { cols: [[{ id: "Rx", arg: "pi/2" }]] };
  await withQuirkPage(browser, circuit, async (page) => {
    for (const [zoom, buttons] of [
      [0.8, ["Zoom out"]],
      [1, []],
      [1.5, ["Zoom in", "Zoom in"]],
    ]) {
      await page.click('[aria-label="Reset zoom"]');
      for (const label of buttons) await page.click(`[aria-label="${label}"]`);
      await page.$eval("#canvasDiv", (element) => element.scrollTo(0, 0));
      const gatePoint = async (offsetFromWire) => {
        await waitForCanvasViewport(page);
        const canvas = await page.$eval("#drawCanvas canvas", (element) =>
          element.getBoundingClientRect().toJSON(),
        );
        const top = await circuitTopForWires(page, 2, zoom);
        return {
          x:
            canvas.x +
            (circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2) *
              zoom,
          y:
            canvas.y +
            (top + circuitMetrics.wireSpacing / 2 + offsetFromWire) * zoom,
        };
      };
      // Pressing the body, even with a small wobble, grabs the gate and puts it back.
      const body = await gatePoint(-10);
      await page.mouse.move(body.x, body.y);
      await page.mouse.down();
      await page.mouse.move(body.x + 3, body.y, { steps: 3 });
      await page.mouse.move(body.x, body.y, { steps: 3 });
      await page.mouse.up();
      await waitForCircuit(page, circuit);
      assert.equal(
        await page.$('[data-panel-id="gate-param"]'),
        null,
        `The body must not edit at ${zoom}x.`,
      );
      let opened = false;
      for (let attempt = 0; attempt < 3 && !opened; attempt++) {
        const indicator = await gatePoint(13);
        await page.mouse.click(indicator.x, indicator.y);
        opened = await page
          .waitForSelector('[data-panel-id="gate-param"]', {
            visible: true,
            timeout: 2000,
          })
          .then(
            () => true,
            () => false,
          );
      }
      assert.ok(opened, `The indicator must edit at ${zoom}x.`);
      // The dial sits in the column past the gate's box, on its wire, at the drawing's zoom.
      const dial = await page.$eval(".wire-dial", (element) =>
        element.getBoundingClientRect().toJSON(),
      );
      const wire = await gatePoint(0);
      const expectedLeft =
        wire.x +
        (2 * circuitMetrics.columnSpacing - circuitMetrics.gateSize / 2) * zoom;
      assert.ok(
        Math.abs(dial.left - expectedLeft) < 2 * zoom,
        `The dial must sit past the box at ${zoom}x: ${dial.left} vs ${expectedLeft}.`,
      );
      assert.ok(
        Math.abs(dial.top + dial.height / 2 - wire.y) < 2 * zoom,
        `The dial must sit on the wire at ${zoom}x.`,
      );
      await closePanel(page, "gate-param");
    }
  });
});

test("a wire's Bloch sphere follows the playhead, and Escape closes the analyzer back to the circuit", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], ["Z"]] }, async (page) => {
    // A short circuit keeps five columns; the wires' outputs stand two past them.
    await openBlochAt(page, 7);
    const shows = (subtitle, id, value) =>
      page.waitForFunction(
        (subtitle, id, value) =>
          document.getElementById("bloch-subtitle")?.textContent === subtitle &&
          document.getElementById(id)?.textContent === value,
        { timeout: TEST_TIMEOUT_MILLIS },
        subtitle,
        id,
        value,
      );
    // At its rest the playhead is past the end: the whole circuit's result, |−⟩.
    await shows("q0 · the whole circuit's result", "bloch-x", "-1.000");
    await page.click("#playhead-reset-button");
    await shows(
      "q0 · at the playhead, before the first column",
      "bloch-z",
      "+1.000",
    );
    await page.click("#playhead-next-button");
    await shows("q0 · at the playhead, after column 1", "bloch-x", "+1.000");

    // The sphere turns by keyboard, and Reset view brings it back.
    await page.focus("#bloch-canvas");
    await page.keyboard.press("ArrowRight");
    await page.waitForSelector("#bloch-reset-view");
    await page.click("#bloch-reset-view");
    await page.waitForFunction(
      () => document.getElementById("bloch-reset-view") === null,
    );

    await page.focus("#bloch-canvas");
    await page.keyboard.press("Escape");
    await waitForPanel(page, "bloch", false);
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      "canvasDiv",
    );
  });
});
