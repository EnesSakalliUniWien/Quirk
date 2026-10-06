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

// The app toolbar: the button row and the WAI-ARIA toolbar pattern.

import assert from "node:assert/strict";
import { EXAMPLE_CIRCUITS } from "../src/config/exampleCircuits.js";
import {
  test,
  withQuirkPage,
  currentCircuit,
  closePanel,
  waitForCircuit,
  TEST_TIMEOUT_MILLIS,
} from "./harness.js";

test("renders the circuit controls as a button toolbar", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    const toolbar = await page.$eval(
      '.app-toolbar[role="toolbar"]',
      (element) => ({
        label: element.getAttribute("aria-label"),
        buttonIds: Array.from(
          element.querySelectorAll('[data-slot="button"]'),
          (button) => button.id,
        ),
        buttonGroupCount: element.querySelectorAll('[data-slot="button-group"]')
          .length,
        // Each separator's neighbours, so the groups can be read off.
        separatorsAfter: Array.from(
          element.querySelectorAll('[role="separator"]'),
          (separator) => separator.previousElementSibling.id,
        ),
      }),
    );

    assert.equal(
      await page.$eval("html", (element) => element.classList.contains("dark")),
      true,
    );
    assert.equal(
      await page.$eval(
        "html",
        (element) => getComputedStyle(element).colorScheme,
      ),
      "dark",
    );
    assert.equal(
      await page.$eval(
        "#drawCanvas canvas",
        (element) => getComputedStyle(element).filter,
      ),
      "none",
    );
    assert.equal(toolbar.label, "Circuit controls");
    // App identity belongs to the shell, independent of the movable Gates panel.
    const brand = await page.$eval(
      ".app-header > .app-brand strong",
      (element) => element.textContent,
    );
    assert.equal(brand, "Quirk-Bench");
    assert.equal(await page.$(".gate-toolbox .app-brand"), null);
    // Three groups by what the buttons do - the circuit itself, making gates, reading the circuit
    // out - and Clear all last, away from Clear circuit. The row has no button groups, and at this
    // width no More menu.
    assert.deepEqual(toolbar.buttonIds, [
      "examples-button",
      "undo-button",
      "redo-button",
      "clear-circuit-button",
      "inspect-button",
      "gate-forge-button",
      "gate-parameter-button",
      "state-button",
      "probabilities-button",
      "qubits-button",
      "registers-button",
      "algebra-button",
      "tape-button",
      "export-button",
      "clear-all-button",
    ]);
    assert.deepEqual(toolbar.separatorsAfter, [
      "inspect-button",
      "gate-parameter-button",
    ]);
    assert.equal(toolbar.buttonGroupCount, 0);
    // Buttons are named in sentence case; only menu items take title-style capitalization.
    const labels = await page.$$eval(
      '.app-toolbar [data-slot="button"]',
      (els) => els.map((el) => el.getAttribute("aria-label")),
    );
    assert.deepEqual(labels, [
      "Examples",
      "Undo",
      "Redo",
      "Clear circuit",
      "Inspect",
      "Create gate",
      "Gate parameter",
      "State",
      "Probabilities",
      "Qubits",
      "Registers",
      "Algebra",
      "Recordings",
      "Export",
      "Clear all",
    ]);
    // No two buttons wear the same mark.
    const marks = await page.$$eval(
      '.app-toolbar [data-slot="button"] svg',
      (els) => els.map((el) => el.getAttribute("class")),
    );
    assert.equal(
      new Set(marks).size,
      marks.length,
      `Toolbar icons must be distinct: ${marks.join(", ")}`,
    );

    // The destructive action takes the row's slack: never flush against Clear circuit, and
    // visibly apart from its neighbour.
    const clearGap = await page.evaluate(() => {
      const clearCircuit = document
        .getElementById("clear-circuit-button")
        .getBoundingClientRect();
      const neighbour = document
        .getElementById("export-button")
        .getBoundingClientRect();
      const clearAll = document
        .getElementById("clear-all-button")
        .getBoundingClientRect();
      return {
        fromClearCircuit: Math.round(clearAll.left - clearCircuit.right),
        fromNeighbour: Math.round(clearAll.left - neighbour.right),
      };
    });
    assert.ok(
      clearGap.fromClearCircuit >= 100,
      `Clear all must sit well clear of Clear circuit, gap was ${clearGap.fromClearCircuit}px.`,
    );
    assert.ok(
      clearGap.fromNeighbour >= 12,
      `Clear all must sit apart from its neighbour, gap was ${clearGap.fromNeighbour}px.`,
    );

    // The base layer's `font: inherit` reset must not outrank the components layer, or the
    // buttons silently lose their 14px/500 type.
    const typography = await page.$$eval(
      '.app-toolbar [data-slot="button"]',
      (els) =>
        els.map((el) => {
          const s = getComputedStyle(el);
          return `${s.fontSize}/${s.fontWeight}/${el.getBoundingClientRect().height}`;
        }),
    );
    assert.deepEqual([...new Set(typography)], ["14px/500/32"]);

    // WAI-ARIA's toolbar pattern: one tab stop, arrow keys move between the controls.
    const roving = await page.evaluate(() => {
      const items = () => [
        ...document.querySelectorAll('.app-toolbar [data-slot="button"]'),
      ];
      const enabled = items().filter((b) => !b.disabled);
      const press = (key) =>
        document.activeElement.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
          }),
        );
      const stopsOnLoad = items().filter((b) => b.tabIndex === 0).length;
      enabled[0].focus();
      const order = [document.activeElement.id];
      press("ArrowRight");
      order.push(document.activeElement.id);
      press("End");
      order.push(document.activeElement.id);
      press("Home");
      order.push(document.activeElement.id);
      return {
        stopsOnLoad,
        order,
        lastEnabledId: enabled.at(-1).id,
        firstEnabledId: enabled[0].id,
      };
    });
    assert.equal(
      roving.stopsOnLoad,
      1,
      "The toolbar must be a single tab stop.",
    );
    assert.notEqual(
      roving.order[0],
      roving.order[1],
      "ArrowRight must move off the first control.",
    );
    assert.equal(
      roving.order[2],
      roving.lastEnabledId,
      "End must reach the last enabled control.",
    );
    assert.equal(
      roving.order[3],
      roving.firstEnabledId,
      "Home must return to the first control.",
    );
  });
});

test("the examples menu loads a circuit, and undo puts the old one back", async (browser) => {
  const circuit = { cols: [["X"]] };
  await withQuirkPage(browser, circuit, async (page) => {
    await page.click("#examples-button");
    const item = await page.waitForSelector('.app-menu [role="menuitem"]', {
      timeout: TEST_TIMEOUT_MILLIS,
    });
    assert.equal(
      await item.evaluate((element) => element.getAttribute("aria-label")),
      EXAMPLE_CIRCUITS[0].name,
    );

    await item.click();
    await page.waitForFunction(
      (startJson) => {
        const params = new URLSearchParams(
          document.location.hash.slice(1).replace(/\+/g, "%2B"),
        );
        return (params.get("circuit") ?? "") !== startJson;
      },
      { timeout: TEST_TIMEOUT_MILLIS },
      JSON.stringify(circuit),
    );
    const loaded = await currentCircuit(page);
    assert.ok(
      JSON.stringify(loaded) !== JSON.stringify(circuit),
      `Choosing an example must load its circuit; the URL carried ${JSON.stringify(loaded)}.`,
    );

    // An example is committed like any other edit, so the circuit that was there comes back.
    await page.click("#undo-button");
    await waitForCircuit(page, circuit);
  });
});

test("toolbar overflow keeps readouts in Inspect and utilities reachable at every width", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"]] },
    async (page) => {
      const row = () =>
        page.$$eval('.app-toolbar [data-slot="button"]', (els) =>
          els.map((el) => el.id),
        );
      const shown = await row();
      // The circuit's own buttons and Clear all stay; only hidden utilities move into More.
      assert.deepEqual(shown.slice(0, 4), [
        "examples-button",
        "undo-button",
        "redo-button",
        "clear-circuit-button",
      ]);
      assert.deepEqual(shown.slice(-2), [
        "toolbar-more-button",
        "clear-all-button",
      ]);
      assert.ok(
        !shown.includes("export-button"),
        `Export must move into More at this width: ${shown.join(", ")}`,
      );
      await page.click("#inspect-button");
      await page.waitForSelector('[data-inspect-panel="state"]');
      assert.deepEqual(
        await page.$$eval("[data-inspect-panel]", (items) =>
          items.map((item) => item.textContent.trim()),
        ),
        [
          "State",
          "Probabilities",
          "Qubits",
          "Registers",
          "Algebra",
          "Recordings",
        ],
      );
      await page.keyboard.press("Escape");

      const utilities = [
        ["forge", "gate-forge-button", "Create Gate"],
        ["gate-param", "gate-parameter-button", "Gate Parameter"],
        ["export", "export-button", "Export"],
      ];
      for (const width of [390, 600, 1280]) {
        await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
        if (width > 390) {
          await page.waitForSelector(
            width === 1280 ? "#export-button" : "#gate-parameter-button",
          );
        }
        const visible = await row();
        assert.ok(
          await page.$eval(
            ".app-toolbar",
            (element) => element.scrollWidth <= element.clientWidth,
          ),
          `The toolbar must fit without scrolling at ${width}px.`,
        );
        const moved = utilities.filter(([, id]) => !visible.includes(id));
        assert.equal(visible.includes("toolbar-more-button"), moved.length > 0);
        if (moved.length > 0) {
          await page.click("#toolbar-more-button");
          await page.waitForSelector(".app-menu [data-toolbar-item]");
          assert.deepEqual(
            await page.$$eval(".app-menu [data-toolbar-item]", (items) =>
              items.map((item) => item.textContent.trim()),
            ),
            moved.map(([, , title]) => title),
            `More must contain only hidden utilities at ${width}px.`,
          );
          await page.keyboard.press("Escape");
        }
        for (const [panel, id] of utilities) {
          if (visible.includes(id)) {
            await page.click(`#${id}`);
          } else {
            await page.click("#toolbar-more-button");
            await page.waitForSelector(`[data-toolbar-item="${id}"]`);
            await page.click(`[data-toolbar-item="${id}"]`);
          }
          await page.waitForSelector(`[data-panel-id="${panel}"]`, {
            visible: true,
            timeout: TEST_TIMEOUT_MILLIS,
          });
          if (panel === "gate-param") {
            await page.click('[data-panel-id="gate-param"] footer button');
            await page.waitForSelector('[data-panel-id="gate-param"]', {
              hidden: true,
            });
          } else {
            await closePanel(page, panel);
          }
        }
      }
    },
    { width: 390, height: 844, deviceScaleFactor: 1 },
  );
});

test("Inspect offers a stable labeled route to every analysis panel", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.click("#inspect-button");
    await page.waitForSelector('[data-inspect-panel="state"]');
    const names = await page.$$eval("[data-inspect-panel]", (items) =>
      items.map((item) => item.textContent.trim()),
    );
    assert.deepEqual(names, [
      "State",
      "Probabilities",
      "Qubits",
      "Registers",
      "Algebra",
      "Recordings",
    ]);
    await page.click('[data-inspect-panel="state"]');
    await page.waitForSelector('[data-panel-id="state"]');
    await page.waitForSelector('[data-inspect-panel="state"]', {
      hidden: true,
    });
    await page.click("#inspect-button");
    await page.waitForSelector('[data-inspect-panel="state"]', {
      visible: true,
    });
    assert.equal(
      await page.$eval('[data-inspect-panel="state"]', (item) =>
        item.getAttribute("aria-current"),
      ),
      "true",
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.activeElement.id === "inspect-button",
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "inspect-button",
    );
  });
});
