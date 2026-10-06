import assert from "node:assert/strict";
import { test, withQuirkPage, waitForQuirk, waitForPanel } from "./harness.js";

const groups = () =>
  document.querySelectorAll(".app-dock .dv-groupview").length;

test("dock folds to tabs and restores wide layout without losing a gate draft", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.click("#gate-forge-button");
    await page.waitForSelector("#gate-forge-rotation-name");
    await page.type("#gate-forge-rotation-name", "unsaved draft");
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("shadow-quant.dock-layout")),
    );
    await page.evaluate(() => {
      window.dockDraftInput = document.querySelector(
        "#gate-forge-rotation-name",
      );
    });
    await page.setViewport({ width: 390, height: 844 });
    await page.waitForFunction(
      () => document.querySelectorAll(".app-dock .dv-groupview").length === 1,
    );
    assert.equal(
      await page.$eval("#gate-forge-rotation-name", (input) => input.value),
      "unsaved draft",
    );
    await page.evaluate(() =>
      [...document.querySelectorAll(".dv-tab")]
        .find((tab) => tab.textContent.trim() === "Circuit")
        .click(),
    );
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("shadow-quant.dock-layout")),
    );
    assert.equal(
      saved.grid.root.data.length,
      before.grid.root.data.length,
      "Narrow tabs must not replace the saved wide splits",
    );
    await page.setViewport({ width: 1280, height: 720 });
    await page.waitForFunction(
      () => document.querySelectorAll(".app-dock .dv-groupview").length === 3,
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.dockDraftInput ===
          document.querySelector("#gate-forge-rotation-name"),
      ),
      true,
    );
    assert.equal(
      await page.$eval("#gate-forge-rotation-name", (input) => input.value),
      "unsaved draft",
    );
    assert.equal(
      await page.$eval("main", (main) => main.getAttribute("aria-label")),
      "Quantum circuit workspace",
    );
  });
});

test("reload at a narrow width retains the saved wide dock and export fits its panel", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.click("#state-button");
    await page.click("#export-button");
    await page.waitForSelector('[data-panel-id="export"] .panel-stack');
    const fits = await page.$eval('[data-panel-id="export"]', (panel) => ({
      panel: panel.clientWidth,
      content: panel.querySelector(".panel-stack").getBoundingClientRect()
        .width,
    }));
    assert.ok(
      fits.content <= fits.panel,
      `Export content ${fits.content} must fit panel ${fits.panel}`,
    );
    await page.setViewport({ width: 600, height: 720 });
    await page.waitForFunction(
      () => document.querySelectorAll(".app-dock .dv-groupview").length === 1,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "Retained hidden inspectors must not make the document horizontally scroll",
    );
    const saved = await page.evaluate(() =>
      localStorage.getItem("shadow-quant.dock-layout"),
    );
    await page.evaluateOnNewDocument(
      (layout) => localStorage.setItem("shadow-quant.dock-layout", layout),
      saved,
    );
    await page.setViewport({ width: 390, height: 844 });
    await page.reload();
    await waitForQuirk(page);
    await page.waitForFunction(
      () => document.querySelectorAll(".app-dock .dv-groupview").length === 1,
    );
    await page.setViewport({ width: 1280, height: 720 });
    await page.waitForFunction(
      () => document.querySelectorAll(".app-dock .dv-groupview").length === 3,
    );
    assert.equal(await page.evaluate(groups), 3);
  });
});

test("dock close supports keyboard and middle click while permanent panels remain", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.click("#state-button");
    await waitForPanel(page, "state", true);
    const tabSelector = '[data-tab-panel-id="state"]';
    const tab = await page.$(tabSelector);
    const bounds = await tab.boundingBox();
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(10, 10);
    await page.mouse.up({ button: "middle" });
    await waitForPanel(page, "state", true);
    await page.click(tabSelector, { button: "middle" });
    await waitForPanel(page, "state", false);

    await page.click("#state-button");
    await waitForPanel(page, "state", true);
    await page.focus('[data-close-panel-id="state"]');
    await page.keyboard.press("Enter");
    await waitForPanel(page, "state", false);

    for (const name of ["circuit", "gates"]) {
      await page.click(`[data-tab-panel-id="${name}"]`, { button: "middle" });
      await waitForPanel(page, name, true);
      assert.equal(
        await page.$(`[data-close-panel-id="${name}"]`),
        null,
        "Permanent panels must not expose Close",
      );
    }
  });
});
