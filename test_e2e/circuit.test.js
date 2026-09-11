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

// The circuit area: loading from a URL, drag editing, and history.

import assert from "node:assert/strict";
import { CanvasTheme, gateStyle } from "../src/config/CanvasTheme.js";
import { Layout } from "../src/config/Layout.js";
import { Typography } from "../src/config/Typography.js";
import {circuitMetrics, test, withQuirkPage, waitForCircuit, currentCircuit, exportedCircuit, waitForPanel, TEST_TIMEOUT_MILLIS, canvasLayout, assertCircuitLayout, circuitTopForWires, waitForCanvasViewport} from "./harness.js";

test("paints canvas colours directly while DOM controls use stylesheet colours", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], ["Bloch"]] }, async (page) => {
    // The probability bars live in the state panel, which is a panel like any other now.
    await page.click("#state-button");
    await waitForPanel(page, "state", true);
    await page.waitForSelector(".state-bar-fill", { timeout: TEST_TIMEOUT_MILLIS });

    const read = () =>
      page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const canvas = document.getElementById("drawCanvas");
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        const context = copy.getContext("2d");
        context.drawImage(canvas, 0, 0);
        const pixel = context.getImageData(1, 1, 1, 1).data;
        return {
          background: style.getPropertyValue("--canvas-background").trim(),
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          probability: getComputedStyle(
            document.querySelector(".state-bar-fill"),
          ).backgroundColor,
          font: getComputedStyle(document.body).fontFamily,
          pixel: [...pixel].slice(0, 3),
        };
      });
    const beforeFonts = await read();
    await page.evaluate(() => document.fonts.ready);
    const afterFonts = await read();
    assert.deepEqual(beforeFonts, afterFonts);
    assert.equal(afterFonts.background, "");
    assert.equal(afterFonts.bodyBackground, "rgb(26, 29, 37)");
    assert.equal(afterFonts.probability, "rgb(34, 197, 94)");
    const expectedFont = await page.evaluate((font) => {
      const element = document.createElement("span");
      element.style.fontFamily = font;
      return element.style.fontFamily;
    }, Typography.DEFAULT_FONT_FAMILY);
    assert.equal(afterFonts.font, expectedFont);
    assert.deepEqual(
      afterFonts.pixel,
      CanvasTheme.surface.background
        .slice(1)
        .match(/../g)
        .map((v) => Number.parseInt(v, 16)),
    );
    // Legacy CSS variables and element backgrounds must not control painted canvas pixels.
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--canvas-background", "red");
      document.getElementById("drawCanvas").style.backgroundColor = "red";
      window.dispatchEvent(new Event("resize"));
    });
    assert.deepEqual((await read()).pixel, afterFonts.pixel);
  });
});

test("loads a URL circuit and renders its Bloch sphere in the circuit area", async (browser) => {
  const circuit = { cols: [["H"], ["Bloch"]] };
  await withQuirkPage(browser, circuit, async (page) => {
    // A panel that is not open has no DOM at all.
    assert.equal(await page.$('[data-panel-id="export"]'), null);
    assert.deepEqual(await exportedCircuit(page), circuit);
    assertCircuitLayout(await canvasLayout(page));
  });
});

test("IQP-dark chips share the canvas assignment and Register clicks survive zoom and DPR", async (browser) => {
  const circuit = { cols: [["H", "Y", "Z"]], init: [0, "-i", "+"] };
  await withQuirkPage(
    browser,
    circuit,
    async (page) => {
      await page.evaluate(() => document.fonts.ready);
      for (const id of ["H", "X", "Y", "Z", "Rx", "Rz", "Measure"]) {
        const colors = await page.$eval(
          `.gate-tile[data-gate-id="${id}"] .gate-chip`,
          (element) => {
            const style = getComputedStyle(element);
            return [style.backgroundColor, style.color];
          },
        );
        const rgb = (hex) =>
          `rgb(${hex
            .slice(1)
            .match(/../g)
            .map((v) => Number.parseInt(v, 16))
            .join(", ")})`;
        const style = gateStyle({ serializedId: id });
        assert.deepEqual(colors, [rgb(style.fill), rgb(style.text)]);
      }
      for (const zoom of [1, 0.8]) {
        if (zoom === 0.8)
          await page.click('.circuit-zoom-button[aria-label="Zoom out"]');
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        await waitForCanvasViewport(page);
        const top = await circuitTopForWires(page, 3, zoom);
        const bounds = await page.$eval("#drawCanvas", (element) => {
          const r = element.getBoundingClientRect();
          const div = document.getElementById("canvasDiv");
          return { x: r.x - div.scrollLeft, y: r.y - div.scrollTop };
        });
        const click = (x) =>
          page.mouse.click(
            bounds.x + x * zoom,
            bounds.y + (top + 1.5 * Layout.WIRE_SPACING) * zoom,
          );
        const before = await currentCircuit(page);
        await click(Layout.REGISTER_MARGIN + Layout.REGISTER_INDEX_WIDTH / 2);
        assert.deepEqual(await currentCircuit(page), before);
        await click(
          2 * Layout.REGISTER_MARGIN +
            Layout.REGISTER_INDEX_WIDTH +
            Layout.REGISTER_KET_WIDTH / 2,
        );
        await waitForCircuit(page, {
          cols: circuit.cols,
          init: [0, zoom === 1 ? 0 : 1, "+"],
        });
      }
    },
    { width: 1440, height: 1000, deviceScaleFactor: 2 },
  );
});

test("drags a gate onto a wire and supports undo, redo, and clear actions", async (browser) => {
  await withQuirkPage(browser, { cols: [] }, async (page) => {
    const canvasBounds = await page.$eval("#drawCanvas", (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    });
    const halfTurnH = await page.evaluate(() => {
      const tile = [...document.querySelectorAll(".gate-tile")].find(
        (e) => e.getAttribute("aria-label") === "Hadamard Gate",
      );
      // The gate list scrolls inside the sidebar, so the tile has to be brought into view
      // before its on-screen position means anything.
      tile.scrollIntoView({ block: "center" });
      const bounds = tile.getBoundingClientRect();
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
    });
    await waitForCanvasViewport(page);
    const circuitTop = await circuitTopForWires(page, 2);
    const firstWireFirstColumn = {
      x:
        canvasBounds.x +
        (circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2),
      y: canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2,
    };

    await page.mouse.move(halfTurnH.x, halfTurnH.y);
    await page.mouse.down();
    await page.mouse.move(firstWireFirstColumn.x, firstWireFirstColumn.y, {
      steps: 10,
    });
    await page.mouse.up();

    const circuitWithH = { cols: [["H"]] };
    const emptyCircuit = { cols: [] };
    await waitForCircuit(page, circuitWithH);
    assert.equal(
      await page.$eval("#undo-button", (button) => button.disabled),
      false,
    );
    assert.equal(
      await page.$eval("#redo-button", (button) => button.disabled),
      true,
    );

    await page.click("#undo-button");
    await waitForCircuit(page, emptyCircuit);
    assert.equal(
      await page.$eval("#redo-button", (button) => button.disabled),
      false,
    );

    await page.click("#redo-button");
    await waitForCircuit(page, circuitWithH);

    await page.click("#clear-circuit-button");
    await waitForCircuit(page, emptyCircuit);

    await page.click("#undo-button");
    await waitForCircuit(page, circuitWithH);
    await page.click("#clear-all-button");
    await waitForCircuit(page, emptyCircuit);
    assert.deepEqual(await currentCircuit(page), emptyCircuit);
  });
});

test("undoes and redoes with both the control and command modifiers", async (browser) => {
  const circuitWithH = { cols: [["H"]] };
  const emptyCircuit = { cols: [] };
  await withQuirkPage(browser, circuitWithH, async (page) => {
    // Command is the primary modifier on macOS; control is the primary modifier elsewhere.
    for (const modifier of ["Meta", "Control"]) {
      await page.click("#clear-circuit-button");
      await waitForCircuit(page, emptyCircuit);

      await page.keyboard.down(modifier);
      await page.keyboard.press("KeyZ");
      await page.keyboard.up(modifier);
      await waitForCircuit(page, circuitWithH);

      await page.keyboard.down(modifier);
      await page.keyboard.down("Shift");
      await page.keyboard.press("KeyZ");
      await page.keyboard.up("Shift");
      await page.keyboard.up(modifier);
      await waitForCircuit(page, emptyCircuit);
    }
  });
});

test("keeps drops accurate while zoomed out and fits the circuit on demand", async (browser) => {
  await withQuirkPage(browser, { cols: [] }, async (page) => {
    const readout = () =>
      page.$eval(
        ".circuit-zoom-button[aria-live]",
        (element) => element.textContent,
      );

    await page.click('.circuit-zoom-button[aria-label="Zoom out"]');
    assert.equal(await readout(), "80%");

    const canvasBounds = await page.$eval("#drawCanvas", (element) => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y };
    });
    const halfTurnH = await page.evaluate(() => {
      const tile = [...document.querySelectorAll(".gate-tile")].find(
        (e) => e.getAttribute("aria-label") === "Hadamard Gate",
      );
      tile.scrollIntoView({ block: "center" });
      const bounds = tile.getBoundingClientRect();
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
    });
    // On-screen pixels are circuit coordinates scaled by the zoom, so the drop target for the
    // first wire's first column shrinks with it.
    await waitForCanvasViewport(page);
    const circuitTop = await circuitTopForWires(page, 2, 0.8);
    const firstWireFirstColumn = {
      x:
        canvasBounds.x +
        (circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2) * 0.8,
      y: canvasBounds.y + (circuitTop + circuitMetrics.wireSpacing / 2) * 0.8,
    };
    await page.mouse.move(halfTurnH.x, halfTurnH.y);
    await page.mouse.down();
    await page.mouse.move(firstWireFirstColumn.x, firstWireFirstColumn.y, {
      steps: 10,
    });
    await page.mouse.up();
    await waitForCircuit(page, { cols: [["H"]] });

    // Fit includes the Register gutter and never zooms past the natural size.
    await page.click('.circuit-zoom-button[aria-label="Zoom out"]');
    await page.click(
      '.circuit-zoom-button[aria-label="Fit the circuit to the visible area"]',
    );
    await page.waitForFunction(
      () => {
        const zoom = parseInt(
          document.querySelector(".circuit-zoom-button[aria-live]").textContent,
        );
        const div = document.getElementById("canvasDiv");
        return (
          zoom > 64 && zoom <= 100 && div.scrollWidth <= div.clientWidth + 1
        );
      },
      { timeout: TEST_TIMEOUT_MILLIS },
    );
  });
});
