import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { Theme, gateStyle } from "../src/config/Theme.js";
import {
  setColourScheme,
  colourScheme,
} from "../src/appearance/colourScheme.js";
import { Appearance } from "../src/appearance/Appearance.js";
import { CanvasTheme, canvasThemeFor } from "../src/draw/theme/CanvasTheme.js";
import { tileKey } from "../src/draw/renderers/operatorTiles.js";
import { domFor } from "../src/browser/theme/dom.js";
import {
  test,
  withQuirkPage,
  waitForQuirk,
  waitForPanel,
  waitForCircuit,
} from "./harness.js";

test("shared appearance imports no renderer, browser, or CSS implementation", () => {
  const seen = new Set();
  const visit = (url, allowed = ["/src/appearance/"]) => {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const source = readFileSync(url, "utf8");
    for (const [, dependency] of source.matchAll(
      /(?:from\s*|import\s*)['"]([^'"]+)['"]/g,
    )) {
      assert.ok(
        dependency.startsWith("."),
        `Shared appearance imports a package: ${dependency}`,
      );
      const next = new URL(dependency, url);
      assert.ok(
        allowed.some((directory) => next.pathname.includes(directory)),
        `Appearance imports implementation: ${next}`,
      );
      assert.ok(
        next.pathname.endsWith(".js"),
        `Shared appearance imports a stylesheet: ${next}`,
      );
      visit(next, allowed);
    }
  };
  visit(new URL("../src/appearance/Appearance.js", import.meta.url));
  assert.ok(seen.size >= 5);
  // The drawing entry point must also remain independent of browser theme application.
  visit(new URL("../src/config/CanvasTheme.js", import.meta.url), [
    "/src/appearance/",
    "/src/draw/theme/",
  ]);
  const root = new URL("../src/", import.meta.url);
  for (const path of readdirSync(root, { recursive: true }).filter(
    (path) => /\.[jt]sx?$/.test(path) && !path.endsWith(".d.ts"),
  )) {
    if (/\.module\.css['"]/.test(readFileSync(new URL(path, root), "utf8"))) {
      assert.ok(
        path.startsWith("components/"),
        `CSS Module imported outside HTML components: ${path}`,
      );
    }
  }
});

test("JavaScript owns theme assignments at startup and across panels and gate chips", async (browser) => {
  // Prevent a second theme definition from creeping back into the app's own CSS.
  const styles = new URL("../src/", import.meta.url);
  for (const path of readdirSync(styles, { recursive: true }).filter((path) =>
    path.endsWith(".css"),
  )) {
    const source = readFileSync(new URL(path, styles), "utf8");
    assert.doesNotMatch(
      source,
      /--[\w-]+\s*:/,
      `${path}: theme properties belong in JavaScript`,
    );
    assert.doesNotMatch(
      source,
      /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|color-mix)\(/i,
      `${path}: theme colour values belong in JavaScript`,
    );
  }
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await page.evaluateOnNewDocument(() => {
      const observer = new MutationObserver(() => {
        if (document.querySelector("#root > *") !== null) {
          window.themeAtMount =
            document.documentElement.style.getPropertyValue("--card");
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    await waitForQuirk(page);
    assert.equal(
      await page.evaluate(() => window.themeAtMount),
      Theme.dom["--card"],
    );
    const assignments = await page.evaluate(
      (keys) =>
        Object.fromEntries(
          keys.map((key) => [
            key,
            document.documentElement.style.getPropertyValue(key),
          ]),
        ),
      Object.keys({ ...Theme.dom, ...Theme.dockProperties }),
    );
    assert.deepEqual(assignments, { ...Theme.dom, ...Theme.dockProperties });

    const chips = await page.$$eval(".gate-tile", (tiles) =>
      tiles.map((tile) => ({
        id: tile.dataset.gateId,
        fill: tile.querySelector(".gate-chip").style.backgroundColor,
      })),
    );
    assert.ok(chips.length > 90);
    const rgb = (hex) =>
      `rgb(${hex
        .slice(1)
        .match(/../g)
        .map((v) => Number.parseInt(v, 16))
        .join(", ")})`;
    for (const chip of chips)
      assert.equal(chip.fill, rgb(gateStyle({ serializedId: chip.id }).fill));

    for (const [trigger, panel] of [
      ["export-button", "export"],
      ["gate-forge-button", "forge"],
      ["tape-button", "tape"],
    ]) {
      await page.click(`#${trigger}`);
      await waitForPanel(page, panel, true);
      const surface = await page.$eval(
        `[data-tab-panel-id="${panel}"]`,
        (tab) => getComputedStyle(tab.closest(".dv-groupview")).backgroundColor,
      );
      assert.equal(surface, rgb(Theme.dom["--card"]));
    }
    // The Examples popup is portalled outside the dock and must still inherit the theme.
    await page.click("#examples-button");
    await page.waitForSelector(".app-menu", { visible: true });
    assert.equal(
      await page.$eval(".app-menu", (e) => getComputedStyle(e).backgroundColor),
      rgb(Theme.dom["--popover"]),
    );
  });
});

test("looks the way the system does, and follows it when it changes while the app runs", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    const shown = () =>
      page.evaluate(() => ({
        dark: document.documentElement.classList.contains("dark"),
        card: document.documentElement.style.getPropertyValue("--card"),
      }));
    // The harness starts every page on a system set to dark. The app has no appearance setting
    // of its own to disagree with it.
    assert.deepEqual(await shown(), { dark: true, card: Theme.dom["--card"] });
    assert.equal(await page.$("#colour-scheme-button"), null);

    // A theme update must preserve the current document and an unfinished construction.
    await page.click("#gate-forge-button");
    await waitForPanel(page, "forge", true);
    await page.focus("#gate-forge-rotation-name");
    await page.keyboard.type("Unfinished rotation");
    await page.evaluate(() => {
      window.themeDocumentMarker = "same document";
    });
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "light" },
    ]);
    await page.waitForFunction(
      () => !document.documentElement.classList.contains("dark"),
      { timeout: 2000 },
    );
    assert.deepEqual(await shown(), {
      dark: false,
      card: domFor("light")["--card"],
    });
    assert.equal(
      await page.evaluate(() => window.themeDocumentMarker),
      "same document",
    );
    assert.equal(
      await page.$eval("#gate-forge-rotation-name", (e) => e.value),
      "Unfinished rotation",
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "gate-forge-rotation-name",
    );
    await waitForCircuit(page, { cols: [["H"]] });

    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "dark" },
    ]);
    await page.waitForFunction(() =>
      document.documentElement.classList.contains("dark"),
    );
    assert.deepEqual(await shown(), { dark: true, card: Theme.dom["--card"] });
    assert.equal(
      await page.evaluate(() => window.themeDocumentMarker),
      "same document",
    );
    assert.equal(
      await page.$eval("#gate-forge-rotation-name", (e) => e.value),
      "Unfinished rotation",
    );
  });
});

test("a stationary minimap repaints when the system appearance changes", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: Array.from({ length: 30 }, () => ["H"]) },
    async (page) => {
      await page.waitForSelector(".circuit-minimap:not([hidden])");
      const expected = [
        ...canvasThemeFor("light")
          .surface.gate.slice(1)
          .match(/../g)
          .map((hex) => Number.parseInt(hex, 16)),
        255,
      ];
      await page.emulateMediaFeatures([
        { name: "prefers-color-scheme", value: "light" },
      ]);
      await page.waitForFunction(
        (expected) => {
          const canvas = document.querySelector(".circuit-minimap");
          const copy = document.createElement("canvas");
          copy.width = canvas.width;
          copy.height = canvas.height;
          const context = copy.getContext("2d");
          context.drawImage(canvas, 0, 0);
          const pixel = context.getImageData(10, canvas.height - 3, 1, 1).data;
          return expected.every((value, index) => pixel[index] === value);
        },
        { timeout: 3000 },
        expected,
      );
    },
  );
});

test("live palette snapshots and operator tile keys change without mutating prior snapshots", () => {
  const original = colourScheme();
  const before = { appearance: Appearance, canvas: CanvasTheme, theme: Theme };
  const source = { json: '{"cols":[["H"]]}', col: 0, wireCount: 1, time: 0 };
  const key = tileKey(source, 0, 0, 0);
  try {
    setColourScheme(original === "dark" ? "light" : "dark");
    assert.notEqual(Appearance, before.appearance);
    assert.notEqual(CanvasTheme, before.canvas);
    assert.notEqual(Theme, before.theme);
    assert.equal(before.theme.colorScheme, original);
    assert.equal(Theme.canvas, CanvasTheme);
    assert.deepEqual(CanvasTheme, canvasThemeFor(colourScheme()));
    assert.ok(Object.isFrozen(Theme) && Object.isFrozen(Appearance));
    assert.notEqual(tileKey(source, 0, 0, 0), key);
  } finally {
    setColourScheme(original);
  }
});

test("theme changes preserve undo and paused transport while repainting the existing canvas", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["X^t"], ["H"], ["X"]] },
    async (page) => {
      // Add an actual edit, so Undo has useful work to retain.
      await page.focus('.gate-tile[aria-label="Hadamard Gate"]');
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => !document.getElementById("undo-button").disabled,
      );
      await page.click("#playhead-prev-button");
      await page.click("#time-play-button");
      await page.waitForFunction(
        () => document.getElementById("time-hold").textContent === "paused",
      );
      // The hold label updates immediately, but time readouts follow sampled simulation frames.
      // Set a known paused phase and wait for its published readout before comparing themes.
      await page.$eval("#time-scrub", (input) => {
        input.value = "0.5";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForFunction(
        () =>
          document
            .getElementById("time-scrub")
            .getAttribute("aria-valuetext") === "t 0.50",
      );
      const state = () =>
        page.evaluate(() => ({
          position: document.getElementById("playhead-position").textContent,
          t: document.getElementById("time-scrub").value,
          hold: document.getElementById("time-hold").textContent,
          undo: document.getElementById("undo-button").disabled,
          hash: location.hash,
        }));
      const before = await state();
      await page.evaluate(() => {
        window.themeCanvas = document.querySelector("#drawCanvas canvas");
      });
      await page.emulateMediaFeatures([
        { name: "prefers-color-scheme", value: "light" },
      ]);
      await page.waitForFunction(
        () => !document.documentElement.classList.contains("dark"),
      );
      assert.deepEqual(await state(), before);
      assert.equal(
        await page.evaluate(
          () =>
            window.themeCanvas === document.querySelector("#drawCanvas canvas"),
        ),
        true,
      );
      // A paused circuit needs an explicit redraw signal; a CSS-only update leaves this dark.
      await page.waitForFunction(() => {
        const canvas = document.querySelector("#drawCanvas canvas");
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        const context = copy.getContext("2d");
        context.drawImage(canvas, 0, 0);
        return [...context.getImageData(10, 10, 1, 1).data].every(
          (v) => v === 255,
        );
      });
      const lightX = await page.$eval(
        '.gate-tile[data-gate-id="X"] .gate-chip',
        (e) => e.style.backgroundColor,
      );
      assert.equal(lightX, "rgb(0, 45, 156)");
      await page.click("#undo-button");
      await waitForCircuit(page, { cols: [["X^t"], ["H"], ["X"]] });
    },
  );
});
