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

// The transport bar and the state-at-the-playhead panel.

import assert from "node:assert/strict";
import { CanvasTheme } from "../src/config/CanvasTheme.js";
import {
  circuitMetrics,
  test,
  withQuirkPage,
  waitForPanel,
  TEST_TIMEOUT_MILLIS,
  waitForCanvasViewport,
} from "./harness.js";

async function playheadBandPixels(page, columnLeft) {
  await waitForCanvasViewport(page);
  return page.evaluate(
    (left, m, background, bandColor) => {
      const canvas = document.querySelector("#drawCanvas canvas");
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const context = copy.getContext("2d");
      context.drawImage(canvas, 0, 0);
      // The strip between this spec's two wire rows; the circuit band centers vertically, so
      // the sample follows the same layout the app computes.
      const div = document.getElementById("canvasDiv");
      const band = 1.5 * m.wireSpacing + m.gateSize / 2 + m.bottomMargin;
      const top = Math.max(
        m.topMargin,
        Math.floor(
          (Math.max(div.clientHeight, band + 2 * m.topMargin) - band) / 2,
        ),
      );
      const data = context.getImageData(
        left - 3,
        top + m.wireSpacing - 4,
        46,
        8,
      ).data;
      // Compare against the actual theme's composited band, independent of its hue.
      const sample = document.createElement("canvas").getContext("2d");
      sample.fillStyle = background;
      sample.fillRect(0, 0, 1, 1);
      sample.fillStyle = bandColor;
      sample.fillRect(0, 0, 1, 1);
      const expected = sample.getImageData(0, 0, 1, 1).data;
      let bandPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (
          [0, 1, 2].every(
            (channel) => Math.abs(data[i + channel] - expected[channel]) <= 2,
          )
        ) {
          bandPixels++;
        }
      }
      return bandPixels;
    },
    columnLeft,
    circuitMetrics,
    CanvasTheme.surface.background,
    CanvasTheme.interaction.playheadBand,
  );
}

/**
 * Waits for the canvas to repaint the band where it is expected: a step's readout and state table
 * can change a frame before the canvas does.
 */
async function waitForBand(page, columnLeft, banded) {
  const started = Date.now();
  for (;;) {
    const pixels = await playheadBandPixels(page, columnLeft);
    if (banded ? pixels > BANDED_PIXELS : pixels < UNBANDED_PIXELS)
      return pixels;
    if (Date.now() - started > TEST_TIMEOUT_MILLIS) return pixels;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const FIRST_COLUMN_LEFT = circuitMetrics.firstColumnLeft;
const SECOND_COLUMN_LEFT = FIRST_COLUMN_LEFT + circuitMetrics.columnSpacing;
const BANDED_PIXELS = 250;
const UNBANDED_PIXELS = 20;

async function waitForPlayhead(page, expectedPosition, expectedKets) {
  await page.waitForFunction(
    (position, kets) => {
      if (
        document.getElementById("playhead-position").textContent !== position
      ) {
        return false;
      }
      const shown = [...document.querySelectorAll("#state-table-body tr")]
        .filter((row) => row.style.display !== "none")
        .map((row) => row.cells[0].textContent.trim());
      return shown.join(",") === kets;
    },
    { timeout: TEST_TIMEOUT_MILLIS },
    expectedPosition,
    expectedKets.join(","),
  );
}

async function stateTableRows(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#state-table-body tr")]
      .filter((row) => row.style.display !== "none")
      .map((row) => ({
        ket: row.cells[0].textContent.trim(),
        probability: Number.parseFloat(row.cells[1].textContent.trim()),
        amplitude: row.cells[2].textContent.trim(),
        phase: Number.parseFloat(row.cells[3].textContent.trim()),
      })),
  );
}

test("steps the circuit with the transport controls and reports the state at the playhead", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"], ["\u2022", "X"]] },
    async (page) => {
      // The strip is the labelled group; the scrub sits beside its buttons, not inside them.
      const transport = await page.$eval(
        '.transport-bar[role="group"]',
        (element) => ({
          label: element.getAttribute("aria-label"),
          buttonLabels: Array.from(
            element.querySelectorAll('[data-slot="button"]'),
            (b) => b.textContent,
          ),
          scrubMax: element.querySelector("#playhead-scrub").max,
        }),
      );

      // The amplitudes at the playhead are their own panel now.
      await page.click("#state-button");
      await waitForPanel(page, "state", true);
      assert.equal(transport.label, "Playback controls");
      // ket writes its arrows as ASCII; here they are drawn glyphs, so the labels are the words.
      // The Steps lane ends in its speed and its Record menu; without a gate that uses t, the Time
      // lane offers nothing to press.
      assert.deepEqual(transport.buttonLabels, [
        "Reset",
        "Prev",
        "Play steps",
        "Next",
        "End",
        "Breakpoint",
        "1×",
        "Record",
      ]);
      assert.equal(transport.scrubMax, "2");

      assert.deepEqual(
        await page.$$eval("#state-table thead th", (els) =>
          els.map((e) => e.textContent),
        ),
        ["state", "probability", "amplitude", "phase (deg)"],
      );

      // The playhead rests at the end: the whole circuit has run, so the state is its answer and
      // no column is next.
      await waitForPlayhead(page, "operation 2 / 2", [
        "|00\u27E9",
        "|11\u27E9",
      ]);
      assert.equal(
        await page.$eval("#playhead-next-button", (b) => b.disabled),
        true,
      );
      assert.ok(
        (await waitForBand(page, FIRST_COLUMN_LEFT, false)) < UNBANDED_PIXELS,
        "A circuit at rest has no next column to mark.",
      );

      // Reset goes to the start: nothing has run, so the state is the all-zero input and the
      // band marks the first column.
      await page.click("#playhead-reset-button");
      await waitForPlayhead(page, "operation 0 / 2", ["|00\u27E9"]);
      assert.equal(
        await page.$eval("#state-summary", (e) => e.textContent),
        "2 qubits \u00B7 4 amplitudes \u00B7 1 nonzero",
      );
      assert.ok(
        (await waitForBand(page, FIRST_COLUMN_LEFT, true)) > BANDED_PIXELS,
        "The playhead band must mark the column about to execute.",
      );
      assert.ok(
        (await playheadBandPixels(page, SECOND_COLUMN_LEFT)) < UNBANDED_PIXELS,
        "The playhead band must not mark a column that is not next.",
      );
      assert.equal(
        await page.$eval("#playhead-prev-button", (b) => b.disabled),
        true,
      );

      // The Hadamard has run: an even superposition of the first wire, and the band has moved on.
      await page.click("#playhead-next-button");
      await waitForPlayhead(page, "operation 1 / 2", [
        "|00\u27E9",
        "|01\u27E9",
      ]);
      const afterHadamard = await stateTableRows(page);
      assert.deepEqual(
        afterHadamard.map((e) => e.probability),
        [0.5, 0.5],
      );
      assert.deepEqual(
        afterHadamard.map((e) => e.phase),
        [0, 0],
      );
      assert.ok(
        (await waitForBand(page, SECOND_COLUMN_LEFT, true)) > BANDED_PIXELS,
        "The playhead band must follow the playhead.",
      );
      assert.ok(
        (await playheadBandPixels(page, FIRST_COLUMN_LEFT)) < UNBANDED_PIXELS,
        "The playhead band must leave the column it has run.",
      );

      // And now the controlled not, which entangles the wires into a Bell pair.
      await page.click("#playhead-end-button");
      await waitForPlayhead(page, "operation 2 / 2", [
        "|00\u27E9",
        "|11\u27E9",
      ]);
      assert.deepEqual(
        (await stateTableRows(page)).map((e) => e.probability),
        [0.5, 0.5],
      );
      assert.equal(
        await page.$eval("#playhead-next-button", (b) => b.disabled),
        true,
      );
      assert.ok(
        (await waitForBand(page, SECOND_COLUMN_LEFT, false)) < UNBANDED_PIXELS,
        "A circuit that has fully run has no next column to mark.",
      );

      await page.click("#playhead-reset-button");
      await waitForPlayhead(page, "operation 0 / 2", ["|00\u27E9"]);
      assert.equal(await page.$eval("#playhead-scrub", (e) => e.value), "0");
    },
  );
});

test("transport skips display columns in both directions and highlights the next operation", async (browser) => {
  // Amps1 is two columns wide, so the first X stands a column past it.
  await withQuirkPage(
    browser,
    { cols: [["Amps1"], [], ["X"], ["Bloch"], [], ["X"], ["Sample1"]] },
    async (page) => {
      const columnLeft = (col) =>
        FIRST_COLUMN_LEFT + col * circuitMetrics.columnSpacing;
      await page.click("#state-button");
      await waitForPanel(page, "state", true);
      await page.click("#playhead-reset-button");
      await waitForPlayhead(page, "operation 0 / 2", ["|00⟩"]);
      assert.equal(await page.$eval("#playhead-scrub", (e) => e.max), "2");
      assert.ok((await waitForBand(page, columnLeft(2), true)) > BANDED_PIXELS);
      assert.ok(
        (await playheadBandPixels(page, FIRST_COLUMN_LEFT)) < UNBANDED_PIXELS,
      );
      await page.click("#playhead-next-button");
      await waitForPlayhead(page, "operation 1 / 2", ["|01⟩"]);
      assert.ok((await waitForBand(page, columnLeft(5), true)) > BANDED_PIXELS);
      await page.click("#playhead-next-button");
      await waitForPlayhead(page, "operation 2 / 2", ["|00⟩"]);
      assert.equal(
        await page.$eval("#playhead-next-button", (e) => e.disabled),
        true,
      );
      await page.click("#playhead-prev-button");
      await waitForPlayhead(page, "operation 1 / 2", ["|01⟩"]);
      await page.$eval("#playhead-scrub", (e) => {
        e.value = "0";
        e.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await waitForPlayhead(page, "operation 0 / 2", ["|00⟩"]);
    },
  );
});

test("the transport is two lanes on one grid, Play over Play and speed over speed", async (browser) => {
  await withQuirkPage(browser, { cols: [["X^t"], ["X"]] }, async (page) => {
    await page.waitForSelector("#time-play-button");
    const x = (id) =>
      page.$eval("#" + id, (e) => Math.round(e.getBoundingClientRect().x));
    assert.deepEqual(
      await page.$$eval('.transport-bar [role="group"][aria-label]', (lanes) =>
        lanes
          .filter((lane) =>
            ["Steps", "Time"].includes(lane.getAttribute("aria-label")),
          )
          .map((lane) => lane.getAttribute("aria-label")),
      ),
      ["Steps", "Time"],
    );
    assert.equal(await x("time-play-button"), await x("playhead-play-button"));
    assert.equal(
      await x("time-forward-button"),
      await x("playhead-next-button"),
    );
    assert.equal(await x("time-scrub"), await x("playhead-scrub"));
    assert.equal(await x("time-speed-button"), await x("steps-speed-button"));
  });
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    await waitForCanvasViewport(page);
    assert.equal(await page.$("#time-play-button"), null);
    assert.match(
      await page.$eval('[aria-label="Time"]', (lane) => lane.textContent),
      /No gate in this circuit uses t/,
    );
  });
});

test("stepping never moves t, and the Time lane plays, pauses, scrubs and nudges it", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["X^t"], ["H"], ["X"]] },
    async (page) => {
      await page.waitForSelector("#time-play-button");
      const t = () => page.$eval("#time-scrub", (scrub) => Number(scrub.value));
      const apart = (a, b) => Math.abs(((((a - b) % 1) + 1.5) % 1) - 0.5);
      const position = (text) =>
        page.waitForFunction(
          (expected) =>
            document
              .getElementById("playhead-position")
              .textContent.startsWith(expected),
          { timeout: 2000 },
          text,
        );
      const moves = async () => {
        const before = await t();
        await new Promise((resolve) => setTimeout(resolve, 400));
        return apart(await t(), before) > 0.01;
      };

      assert.ok(await moves(), "t runs on its own.");
      await page.click("#playhead-reset-button");
      await position("operation 0");
      assert.ok(await moves(), "Reset must not stop t.");
      await page.click("#playhead-next-button");
      await position("operation 1");
      assert.ok(await moves(), "A step must not stop t.");

      await page.click("#time-play-button");
      await page.waitForFunction(
        () => document.getElementById("time-hold").textContent === "paused",
        { timeout: TEST_TIMEOUT_MILLIS },
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      const parked = await t();
      await page.click("#playhead-next-button");
      await position("operation 2");
      await page.click("#playhead-prev-button");
      await position("operation 1");
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(
        await t(),
        parked,
        "Steps either way must leave a paused t where it stands.",
      );

      await page.$eval("#time-scrub", (scrub) => {
        scrub.value = "0.5";
        scrub.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForFunction(
        () => document.getElementById("time-scrub").value === "0.5",
        { timeout: 2000 },
      );
      await page.click("#time-forward-button");
      await page.waitForFunction(
        () => document.getElementById("time-scrub").value === "0.53125",
        { timeout: 2000 },
      );
      await page.click("#time-back-button");
      await page.click("#time-back-button");
      await page.waitForFunction(
        () => document.getElementById("time-scrub").value === "0.46875",
        { timeout: 2000 },
      );

      await page.click("#time-play-button");
      await page.waitForFunction(
        () => document.getElementById("time-hold").textContent === "",
        { timeout: 2000 },
      );
      assert.ok(
        await moves(),
        "Played again, t runs on from where it was put.",
      );
    },
  );
});

test("each lane keeps its own speed, and the browser keeps both", async (browser) => {
  // A context of its own, so the speeds it keeps do not pace the other tests.
  const context = await browser.createBrowserContext();
  try {
    await withQuirkPage(context, { cols: [["X^t"], ["X"]] }, async (page) => {
      const label = (id) =>
        page.$eval("#" + id, (b) => b.getAttribute("aria-label"));
      const t = () => page.$eval("#time-scrub", (scrub) => Number(scrub.value));
      const apart = (a, b) => Math.abs(((((a - b) % 1) + 1.5) % 1) - 0.5);
      // Each lane's menu is named for its speed, so one closing never answers for the other.
      const choose = async (button, menu, multiple) => {
        await page.click("#" + button);
        const items = `[aria-label="${menu}"] [role="menuitemradio"]`;
        await page.waitForSelector(items);
        return page.evaluate(
          (selector, wanted) => {
            const found = [...document.querySelectorAll(selector)];
            const texts = found.map((item) => item.textContent);
            found.find((item) => item.textContent.startsWith(wanted)).click();
            return texts;
          },
          items,
          multiple,
        );
      };
      await page.waitForSelector("#time-play-button");
      assert.equal(await label("steps-speed-button"), "Step speed, 1×");
      assert.equal(await label("time-speed-button"), "t speed, 1×");

      assert.deepEqual(await choose("time-speed-button", "t speed", "4×"), [
        "0.25×t cycles in 32 s",
        "0.5×t cycles in 16 s",
        "1×t cycles in 8 s",
        "2×t cycles in 4 s",
        "4×t cycles in 2 s",
      ]);
      await page.waitForFunction(
        () =>
          document
            .getElementById("time-speed-button")
            .getAttribute("aria-label") === "t speed, 4×",
      );
      assert.equal(
        await label("steps-speed-button"),
        "Step speed, 1×",
        "The Time lane's speed must not pace the steps.",
      );
      // At 4× the cycle takes 2 s, so half a second is a quarter turn.
      const before = await t();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const moved = apart(await t(), before);
      assert.ok(
        Math.abs(moved - 0.25) < 0.1,
        `t moved ${moved} in half a second at 4×.`,
      );

      assert.deepEqual(await choose("steps-speed-button", "Step speed", "2×"), [
        "0.25×a step every 2.4 s",
        "0.5×a step every 1.2 s",
        "1×a step every 0.6 s",
        "2×a step every 0.3 s",
        "4×a step every 0.15 s",
      ]);
      await page.waitForFunction(
        () =>
          document
            .getElementById("steps-speed-button")
            .getAttribute("aria-label") === "Step speed, 2×",
      );

      await page.reload();
      await page.waitForSelector("#time-play-button");
      assert.equal(
        await label("time-speed-button"),
        "t speed, 4×",
        "The browser keeps the Time lane's speed.",
      );
      assert.equal(
        await label("steps-speed-button"),
        "Step speed, 2×",
        "The browser keeps the Steps lane's speed.",
      );
    });
  } finally {
    await context.close();
  }
});

test("a run halts before a breakpoint and before an assertion that fails", async (browser) => {
  // Wire 1 is never put in superposition, so the assertion on it fails.
  await withQuirkPage(
    browser,
    { cols: [["H"], ["X"], ["Z"], [1, "assert-sup1"], ["Y"]] },
    async (page) => {
      const position = (text) =>
        page.waitForFunction(
          (expected) =>
            document.getElementById("playhead-position").textContent.trim() ===
            expected,
          { timeout: 2000 },
          text,
        );
      // The breakpoint goes on the operation the playhead stands before: from the start, Next, then
      // the X column.
      await page.click("#playhead-reset-button");
      await position("operation 0 / 4");
      await page.click("#playhead-next-button");
      await position("operation 1 / 4");
      assert.equal(
        await page.$eval("#breakpoint-toggle-button", (b) =>
          b.getAttribute("aria-pressed"),
        ),
        "false",
      );
      await page.click("#breakpoint-toggle-button");
      await page.waitForSelector(
        '#breakpoint-toggle-button[aria-pressed="true"]',
      );

      await page.click("#playhead-reset-button");
      await position("operation 0 / 4");
      await page.click("#playhead-end-button");
      await position("operation 1 / 4");
      // On from the breakpoint, the failing assertion on wire 1 halts the run before its column.
      await page.click("#playhead-end-button");
      await position("operation 3 / 4");
      await page.click("#playhead-end-button");
      await position("operation 4 / 4");
    },
  );
});

test("breakpoints travel in the link, beside the circuit and outside the history", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"], ["X"], ["Z"]] },
    async (page) => {
      const position = (text) =>
        page.waitForFunction(
          (expected) =>
            document.getElementById("playhead-position").textContent.trim() ===
            expected,
          { timeout: 2000 },
          text,
        );
      const entries = await page.evaluate(() => history.length);
      const app = await page.evaluate(
        () => document.location.origin + document.location.pathname,
      );

      await page.click("#playhead-reset-button");
      await position("operation 0 / 3");
      await page.click("#playhead-next-button");
      await position("operation 1 / 3");
      await page.click("#breakpoint-toggle-button");
      await page.waitForFunction(
        () => document.location.hash.endsWith("&breakpoints=1"),
        { timeout: 2000 },
      );
      assert.equal(
        await page.evaluate(() => history.length),
        entries,
        "A breakpoint is no step in the history.",
      );

      // The link alone brings the breakpoint back: a run from the start halts before the X.
      await page.goto("about:blank");
      // Column 7 holds no operation, and is skipped.
      await page.goto(
        `${app}#circuit={"cols":[["H"],["X"],["Z"]]}&breakpoints=1,7`,
      );
      // A circuit opened from a link rests at its end, on its answer; from the start, End halts.
      await position("operation 3 / 3");
      await page.click("#playhead-reset-button");
      await position("operation 0 / 3");
      await page.click("#playhead-end-button");
      await position("operation 1 / 3");
      await page.waitForSelector(
        '#breakpoint-toggle-button[aria-pressed="true"]',
      );

      await page.click("#breakpoint-toggle-button");
      await page.waitForFunction(
        () => !document.location.hash.includes("breakpoints"),
        { timeout: 2000 },
      );
    },
  );
});

test("toggles playback with the space bar", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"], ["X"], ["Z"], ["H"]] },
    async (page) => {
      await page.keyboard.press("Space");
      await page.waitForFunction(
        () =>
          document.getElementById("playhead-play-label").textContent ===
          "Pause steps",
        { timeout: TEST_TIMEOUT_MILLIS },
      );

      await page.keyboard.press("Space");
      await page.waitForFunction(
        () =>
          document.getElementById("playhead-play-label").textContent ===
          "Play steps",
        { timeout: TEST_TIMEOUT_MILLIS },
      );
    },
  );
});

test("space pauses whatever moves, t included, and brings back what it paused", async (browser) => {
  await withQuirkPage(browser, { cols: [["X^t"], ["H"]] }, async (page) => {
    await page.waitForSelector("#time-play-button");
    const hold = () => page.$eval("#time-hold", (e) => e.textContent);
    const steps = () =>
      page.$eval("#playhead-play-label", (e) => e.textContent);
    await page.focus("#canvasDiv");
    // t runs on its own, so Space pauses t and leaves the steps alone.
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () => document.getElementById("time-hold").textContent === "paused",
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    assert.equal(await steps(), "Play steps");
    // The next Space brings t back rather than starting the steps.
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () => document.getElementById("time-hold").textContent === "",
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    assert.equal(await steps(), "Play steps");
    assert.equal(await hold(), "");
  });
});

test("scrubbing to a gate stops playback", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"], ["X"], ["Z"], ["H"]] },
    async (page) => {
      // The label and the readout follow the playhead's state ticks, so each expectation is
      // awaited rather than sampled once.
      await page.click("#playhead-play-button");
      await page.waitForFunction(
        () =>
          document.getElementById("playhead-play-label").textContent ===
          "Pause steps",
        { timeout: TEST_TIMEOUT_MILLIS },
      );

      await page.$eval("#playhead-scrub", (element) => {
        element.value = "3";
        element.dispatchEvent(new Event("input", { bubbles: true }));
      });

      await page.waitForFunction(
        () =>
          document.getElementById("playhead-play-label").textContent ===
          "Play steps",
        { timeout: TEST_TIMEOUT_MILLIS },
      );
      await page.waitForFunction(
        () =>
          document.getElementById("playhead-position").textContent ===
          "operation 3 / 4",
        { timeout: TEST_TIMEOUT_MILLIS },
      );
      assert.equal(
        await page.$eval("#playhead-position", (e) => e.textContent),
        "operation 3 / 4",
      );
    },
  );
});

test("houses the transport in the shell between the toolbar and the work area", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], ["X"]] }, async (page) => {
    // The transport is the shell's own strip, not a band inside a panel: it stays put whatever
    // the dock is showing. It sits at the top of the window, under the toolbar, where moving the
    // window never hides it.
    const placement = await page.evaluate(() => {
      const transport = document
        .querySelector(".transport-bar")
        .getBoundingClientRect();
      const toolbar = document
        .querySelector(".app-toolbar")
        .getBoundingClientRect();
      const work = document.querySelector(".app-dock").getBoundingClientRect();
      return {
        insideAPanel:
          document
            .querySelector(".transport-bar")
            .closest("[data-panel-id]") !== null,
        underTheToolbar: transport.top >= toolbar.bottom - 1,
        aboveTheWorkArea: transport.bottom <= work.top + 1,
      };
    });
    assert.equal(
      placement.insideAPanel,
      false,
      "The transport must not live inside a panel.",
    );
    assert.ok(
      placement.underTheToolbar,
      "The transport must sit under the toolbar.",
    );
    assert.ok(
      placement.aboveTheWorkArea,
      "The transport must sit above the work area.",
    );

    await page.click("#playhead-prev-button");
    await page.waitForFunction(
      () =>
        document
          .getElementById("playhead-position")
          .textContent.startsWith("operation 1"),
      { timeout: 2000 },
    );
  });
});

test("touch playback controls fit a 320px window with full-sized targets", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [["H"], ["Z^t"]] },
    async (page) => {
      await page.waitForFunction(
        () => matchMedia("(any-pointer: coarse)").matches,
      );
      const size = await page.evaluate(() => ({
        width: innerWidth,
        content: document.documentElement.scrollWidth,
        targets: [
          "time-back-button",
          "time-play-button",
          "time-forward-button",
          "inspect-button",
        ].map((id) =>
          document.getElementById(id).getBoundingClientRect().toJSON(),
        ),
      }));
      assert.ok(size.content <= size.width, JSON.stringify(size));
      assert.ok(
        size.targets.every((rect) => rect.width >= 44 && rect.height >= 44),
      );
    },
    {
      width: 320,
      height: 800,
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    },
  );
});

test("time scrubber resumes following t after an interrupted pointer gesture", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], ["Z^t"]] }, async (page) => {
    await page.waitForSelector("#time-scrub");
    for (const ending of [
      "pointercancel",
      "lostpointercapture",
      "blur",
      "pointerup",
    ]) {
      await page.$eval(
        "#time-scrub",
        (input, kind) => {
          input.dispatchEvent(
            new PointerEvent("pointerdown", { pointerId: 7, bubbles: true }),
          );
          input.value = "1";
          if (kind === "blur") window.dispatchEvent(new Event("blur"));
          else if (kind === "pointerup")
            window.dispatchEvent(new PointerEvent(kind, { pointerId: 7 }));
          else
            input.dispatchEvent(
              new PointerEvent(kind, { pointerId: 7, bubbles: true }),
            );
        },
        ending,
      );
      await page.waitForFunction(
        () => Number(document.getElementById("time-scrub").value) < 0.95,
        { timeout: 2500 },
      );
    }
  });
});
