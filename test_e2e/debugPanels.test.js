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

// The playhead's debug panels: each opens from the toolbar into the dock, and each reports the
// state the playhead has reached rather than the whole circuit's.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  test,
  withQuirkPage,
  waitForPanel,
  waitForQuirk,
  waitForCircuit,
  TEST_TIMEOUT_MILLIS,
} from "./harness.js";

const BELL = { cols: [["H"], ["•", "X"]] };

async function runToEnd(page, operations = 2) {
  await page.click("#playhead-end-button");
  await page.waitForFunction(
    (count) =>
      document.getElementById("playhead-position").textContent.trim() ===
      `operation ${count} / ${count}`,
    { timeout: TEST_TIMEOUT_MILLIS },
    operations,
  );
}

test("the algebra panel lists every operation with its matrix and the change it makes", async (browser) => {
  await withQuirkPage(browser, BELL, async (page) => {
    await page.click("#algebra-button");
    await waitForPanel(page, "algebra", true);
    const panel = await page
      .waitForFunction(
        () => {
          const root = document.querySelector('[data-panel-id="algebra"]');
          const steps = root?.querySelectorAll(".algebra-step");
          // The chart paints on the shared renderer after the list renders, so wait for both.
          const chart = root?.querySelector(".algebra-evolution canvas");
          const drawn = chart?.dataset.painted === "true";
          return steps === undefined || steps.length !== 3 || !drawn
            ? false
            : {
                summary: root.querySelector(".debug-panel-summary").textContent,
                descriptions: [
                  ...root.querySelectorAll(".algebra-step-description"),
                ].map((e) => e.textContent),
                // Start shows one state; each step expands operator, input and output.
                tablesPerStep: [...steps].map(
                  (step) => step.querySelectorAll("mtable").length,
                ),
                cnotRows: steps[2]
                  .querySelector("mtable")
                  .querySelectorAll("mtr").length,
                changedAfterCnot:
                  steps[2].querySelectorAll("mtd[data-changed]").length,
                // Three states, one column each, over four basis states: a square cell apiece.
                evolutionShape: chart.width / chart.height,
                chartDetail: chart.dataset.detail,
                chartDescription: document.getElementById(
                  chart.getAttribute("aria-describedby"),
                )?.textContent,
              };
        },
        { timeout: TEST_TIMEOUT_MILLIS },
      )
      .then((handle) => handle.jsonValue());
    assert.match(
      panel.summary,
      /2 steps · 2 qubits · every matrix reproduces the simulated state/,
    );
    assert.equal(panel.descriptions[0], "Start");
    assert.equal(panel.chartDetail, "marks");
    assert.match(
      panel.chartDescription,
      /Columns represent successive circuit steps/,
    );
    assert.match(panel.chartDescription, /rows represent basis states/);
    assert.match(
      panel.chartDescription,
      /Disc radius shows amplitude magnitude/,
    );
    assert.match(panel.chartDescription, /hand direction and hue show phase/);
    assert.match(
      panel.chartDescription,
      /open State for individual amplitude, probability, and phase values/,
    );
    assert.deepEqual(panel.tablesPerStep, [1, 3, 3]);
    assert.equal(panel.cnotRows, 4, "CNOT over two qubits is 4x4.");
    // CNOT moves the |01> amplitude to |11>: exactly those two entries change.
    assert.equal(panel.changedAfterCnot, 2);
    assert.ok(
      Math.abs(panel.evolutionShape - 3 / 4) < 0.01,
      "The chart has a column per step and a row per basis state.",
    );

    // Choosing a step moves the playhead there, and the list marks it.
    await page.evaluate(() =>
      document
        .querySelectorAll('[data-panel-id="algebra"] .algebra-step-header')[1]
        .click(),
    );
    await page.waitForFunction(
      () =>
        document.getElementById("playhead-position").textContent.trim() ===
          "operation 1 / 2" &&
        document
          .querySelectorAll('[data-panel-id="algebra"] .algebra-step')[1]
          .getAttribute("aria-current") === "step",
      { timeout: TEST_TIMEOUT_MILLIS },
    );
  });
});

test("the algebra steps run left to right, follow the playhead and scroll sideways", async (browser) => {
  // Eight steps of two-qubit matrices: far wider than the panel.
  const LONG = {
    cols: [["H"], ["X"], ["H"], ["X"], ["H"], ["X"], ["H"], ["X"]],
  };
  await withQuirkPage(browser, LONG, async (page) => {
    await page.click("#algebra-button");
    await waitForPanel(page, "algebra", true);
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-panel-id="algebra"] .algebra-step')
          .length === 9,
      { timeout: TEST_TIMEOUT_MILLIS },
    );

    const lastInSight = () =>
      page.waitForFunction(
        () => {
          const track = document.querySelector(
            '[data-panel-id="algebra"] .algebra-steps',
          );
          const card = track.querySelector('[data-step="8"]');
          const t = track.getBoundingClientRect(),
            c = card.getBoundingClientRect();
          return (
            card.getAttribute("aria-current") === "step" &&
            c.left >= t.left - 1 &&
            (c.width > t.width ? c.left <= t.left + 1 : c.right <= t.right + 1)
          );
        },
        { timeout: TEST_TIMEOUT_MILLIS },
      );
    const layout = await page.evaluate(() => {
      const track = document.querySelector(
        '[data-panel-id="algebra"] .algebra-steps',
      );
      const [first, second] = track.querySelectorAll(".algebra-step");
      const a = first.getBoundingClientRect(),
        b = second.getBoundingClientRect();
      return {
        sideBySide: b.left >= a.right - 1 && Math.abs(b.top - a.top) < 1,
        overflows: track.scrollWidth > track.clientWidth,
      };
    });
    assert.ok(
      layout.sideBySide,
      "Steps must run left to right, not down the panel.",
    );
    assert.ok(
      layout.overflows,
      "Eight steps must be wider than the panel, so it scrolls.",
    );
    // The panel opens on the playhead's step: at rest, the last.
    await lastInSight();

    // Back at the start, the view goes with the playhead to the first step.
    await page.click("#playhead-reset-button");
    await page.waitForFunction(
      () => {
        const track = document.querySelector(
          '[data-panel-id="algebra"] .algebra-steps',
        );
        return (
          track.scrollLeft === 0 &&
          track
            .querySelector('[data-step="0"]')
            .getAttribute("aria-current") === "step"
        );
      },
      { timeout: TEST_TIMEOUT_MILLIS },
    );

    // A horizontal gesture over the steps scrolls them sideways.
    const box = await page.$eval(
      '[data-panel-id="algebra"] .algebra-steps',
      (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + 40 };
      },
    );
    await page.mouse.move(box.x, box.y);
    await page.mouse.wheel({ deltaX: 400 });
    await page.waitForFunction(
      () =>
        document.querySelector('[data-panel-id="algebra"] .algebra-steps')
          .scrollLeft > 0,
      { timeout: TEST_TIMEOUT_MILLIS },
    );

    // Stepping moves the view with it: the last step ends up in sight.
    await page.click("#playhead-end-button");
    await lastInSight();
  });
});

test("rotation entries are written as cosines and sines of their angle", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [[{ id: "Rx", arg: "pi/4" }]] },
    async (page) => {
      await page.click("#algebra-button");
      await waitForPanel(page, "algebra", true);
      const functions = await page
        .waitForFunction(
          () => {
            const step = document.querySelectorAll(
              '[data-panel-id="algebra"] .algebra-step',
            )[1];
            const names =
              step === undefined
                ? []
                : [
                    ...step
                      .querySelectorAll("mtable")[0]
                      .querySelectorAll("mi"),
                  ].map((e) => e.textContent);
            return names.includes("cos") ? names : false;
          },
          { timeout: TEST_TIMEOUT_MILLIS },
        )
        .then((handle) => handle.jsonValue());
      // Rx(π/4) is cos(π/8) on the diagonal and -i sin(π/8) off it.
      assert.ok(functions.includes("cos"));
      assert.ok(functions.includes("sin"));
    },
  );
});

test("every step of a large register is drawn as an operator that zooms to its entries", async (browser) => {
  // Twelve qubits: 4096 x 4096 operators, far too many entries to write out or to draw as discs.
  const WIDE = {
    cols: [["H"], ["•", 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, "X"], ["inc12"]],
  };
  await withQuirkPage(browser, WIDE, async (page) => {
    await page.click("#algebra-button");
    await waitForPanel(page, "algebra", true);
    const drawn = await page
      .waitForFunction(
        () => {
          const root = document.querySelector('[data-panel-id="algebra"]');
          const views = [
            ...(root?.querySelectorAll(".operator-view-canvas") ?? []),
          ];
          const chart = root?.querySelector(".algebra-evolution canvas");
          return views.length !== 3 ||
            views.some((v) => v.dataset.painted !== "true") ||
            chart?.dataset.painted !== "true"
            ? false
            : {
                summary: root.querySelector(".debug-panel-summary").textContent,
                chartDetail: chart.dataset.detail,
                chartDescription: document.getElementById(
                  chart.getAttribute("aria-describedby"),
                )?.textContent,
                notes: [...root.querySelectorAll(".debug-panel-note")].map(
                  (e) => e.textContent,
                ),
              };
        },
        { timeout: TEST_TIMEOUT_MILLIS },
      )
      .then((handle) => handle.jsonValue());
    assert.match(
      drawn.summary,
      /3 steps · 12 qubits · every matrix reproduces the simulated state/,
    );
    assert.equal(
      drawn.chartDetail,
      "pixels",
      "Past a few pixels per entry the chart is drawn as pixels.",
    );
    assert.deepEqual(drawn.notes, [], "No step may stop at a size limit.");
    assert.match(
      drawn.chartDescription,
      /opacity shows magnitude relative to the largest amplitude/,
    );
    assert.match(drawn.chartDescription, /visibility floor/);
    assert.match(
      drawn.chartDescription,
      /Where basis states share a pixel, it shows the largest amplitude/,
    );
    assert.match(drawn.chartDescription, /hue shows phase/);

    // Zooming in twice asks for finer tiles, and draws them.
    const card = '[data-panel-id="algebra"] [data-step="3"]';
    await page.click(`${card} button[aria-label="Zoom in"]`);
    await page.click(`${card} button[aria-label="Zoom in"]`);
    await page.waitForFunction(
      (card) => {
        const view = document.querySelector(`${card} .operator-view-canvas`);
        return (
          document.querySelector(`${card} .operator-view-zoom`).textContent ===
            "×4" &&
          view.dataset.level === "2" &&
          view.dataset.painted === "true"
        );
      },
      { timeout: TEST_TIMEOUT_MILLIS },
      card,
    );

    // Hovering reads an entry's exact value off the step's structure.
    const box = await page.$eval(`${card} .operator-view-canvas`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    const readout = await page
      .waitForFunction(
        (card) => {
          const text = document.querySelector(
            `${card} .operator-view-readout`,
          ).textContent;
          return text.includes("|U|") ? text : false;
        },
        { timeout: TEST_TIMEOUT_MILLIS },
        card,
      )
      .then((handle) => handle.jsonValue());
    assert.match(readout, /⟨[01]{12}\|U\|[01]{12}⟩ = /);
  });
});

test("the operator tile worker ships without Pixi Layout and its Yoga engine", () => {
  const assets = new URL("../out/assets/", import.meta.url);
  const workers = readdirSync(assets).filter((name) =>
    /^operatorTiles\.worker-.+\.js$/.test(name),
  );
  assert.equal(workers.length, 1, "One built operator tile worker.");
  assert.doesNotMatch(
    readFileSync(new URL(workers[0], assets), "utf8"),
    /yoga/i,
    "The worker draws nothing, so its bundle must not carry the layout engine.",
  );
});

/**
 * The Probabilities panel's traces, once there are `count` of them: each one's title, its step
 * numbers, which step is the playhead's, and every row's ket, then each step's percentage and mark
 * ("" for a step the playhead has not reached).
 */
async function readStepTables(page, count) {
  return page
    .waitForFunction(
      (expected) => {
        const figures = [
          ...document.querySelectorAll(
            '[data-panel-id="probabilities"] .probabilities-group',
          ),
        ];
        return figures.length !== expected
          ? false
          : figures.map((figure) => ({
              title:
                figure.querySelector(".probabilities-group-title")
                  ?.textContent ?? null,
              steps: [
                ...figure.querySelectorAll(".probabilities-step-number"),
              ].map((e) => e.textContent),
              current: [
                ...figure.querySelectorAll("thead th[data-step]"),
              ].findIndex((e) => e.getAttribute("aria-current") === "step"),
              rows: [...figure.querySelectorAll("tbody tr")].map((row) => [
                row.querySelector("th").textContent,
                ...[...row.querySelectorAll("td")].map(
                  (cell) =>
                    (cell.querySelector(".probabilities-value")?.textContent ??
                      "") +
                    (cell.querySelector(".probabilities-change")?.textContent ??
                      ""),
                ),
              ]),
              note:
                figure.querySelector(".debug-panel-note")?.textContent ?? null,
            }));
      },
      { timeout: TEST_TIMEOUT_MILLIS },
      count,
    )
    .then((handle) => handle.jsonValue());
}

test("the probabilities panel traces every outcome through the steps the playhead has reached", async (browser) => {
  await withQuirkPage(browser, BELL, async (page) => {
    await runToEnd(page);
    await page.click("#probabilities-button");
    await waitForPanel(page, "probabilities", true);
    // H spreads q0 over 00 and 01; the CNOT then pairs them into 00 and 11. ▲ and ▼ mark what each step changed.
    const [table] = await readStepTables(page, 1);
    assert.deepEqual(table, {
      title: null,
      steps: ["0", "1", "2"],
      current: 2,
      note: null,
      rows: [
        ["|00⟩", "100", "50.0▼", "50.0"],
        ["|01⟩", "0", "50.0▲", "0▼"],
        ["|10⟩", "0", "0", "0"],
        ["|11⟩", "0", "0", "50.0▲"],
      ],
    });
    assert.equal(
      await page.$eval(
        '[data-panel-id="probabilities"] .debug-panel-summary',
        (e) => e.textContent,
      ),
      "2 of 4 outcomes possible · largest 50.0%",
    );

    // Back to step 1 through its header: the playhead follows, and the later step empties.
    await page.$$eval(
      '[data-panel-id="probabilities"] .probabilities-step-header',
      (buttons) => buttons[1].click(),
    );
    await page.waitForFunction(
      () =>
        document.getElementById("playhead-position").textContent.trim() ===
        "operation 1 / 2",
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    await page.waitForFunction(
      () =>
        [
          ...document.querySelectorAll(
            '[data-panel-id="probabilities"] thead th[data-step]',
          ),
        ].findIndex((e) => e.getAttribute("aria-current") === "step") === 1,
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    const [earlier] = await readStepTables(page, 1);
    assert.deepEqual(earlier.rows, [
      ["|00⟩", "100", "50.0▼", ""],
      ["|01⟩", "0", "50.0▲", ""],
      ["|10⟩", "0", "0", ""],
      ["|11⟩", "0", "0", ""],
    ]);
  });
});

test("the probabilities panel groups qubits correlated at any step, and splits off the independent ones", async (browser) => {
  // A Bell pair on q0 q1, a fair coin on q2 and a wire turned about a tenth of the way to 1 on q3.
  const circuit = {
    cols: [
      ["H", 1, "H", { id: "Rx", arg: "0.64" }],
      ["•", "X"],
    ],
  };
  await withQuirkPage(browser, circuit, async (page) => {
    await runToEnd(page);
    await page.click("#probabilities-button");
    await waitForPanel(page, "probabilities", true);
    await page.waitForSelector("#probabilities-layout-grouped", {
      timeout: TEST_TIMEOUT_MILLIS,
    });
    await page.click("#probabilities-layout-grouped");
    const tables = await readStepTables(page, 3);
    assert.deepEqual(
      tables.map(({ title, rows }) => ({ title, rows })),
      [
        {
          title: "q1 q0 · correlated",
          rows: [
            ["|00⟩", "100", "50.0▼", "50.0"],
            ["|01⟩", "0", "50.0▲", "0▼"],
            ["|10⟩", "0", "0", "0"],
            ["|11⟩", "0", "0", "50.0▲"],
          ],
        },
        {
          title: "q2 · independent",
          rows: [
            ["|0⟩", "100", "50.0▼", "50.0"],
            ["|1⟩", "0", "50.0▲", "50.0"],
          ],
        },
        {
          title: "q3 · independent",
          rows: [
            ["|0⟩", "100", "90.1▼", "90.1"],
            ["|1⟩", "0", "9.9▲", "9.9"],
          ],
        },
      ],
    );
    assert.equal(
      await page.$eval("#probabilities-layout-grouped", (tab) =>
        tab.hasAttribute("data-active"),
      ),
      true,
    );
  });
});

test("the probabilities panel keeps a large state to the outcomes some step allows", async (browser) => {
  // Eight wires: H on the first, a small Rx on the second, and Z, which changes no probability,
  // keeping the other six in use.
  const circuit = {
    cols: [["H", { id: "Rx", arg: "0.2" }, "Z", "Z", "Z", "Z", "Z", "Z"]],
  };
  await withQuirkPage(browser, circuit, async (page) => {
    await runToEnd(page, 1);
    await page.click("#probabilities-button");
    await waitForPanel(page, "probabilities", true);
    const [table] = await readStepTables(page, 1);
    assert.deepEqual(table.rows, [
      ["|00000000⟩", "100", "49.5▼"],
      ["|00000001⟩", "0", "49.5▲"],
      ["|00000010⟩", "0", "0.5▲"],
      ["|00000011⟩", "0", "0.5▲"],
    ]);
    assert.match(table.note, /^252 more outcomes are not shown/);
  });
});

test("spinning gates keep turning while the circuit is stepped, and stand still when t is paused", async (browser) => {
  // Steps and time are separate lanes: running the playhead to the end leaves X^t turning its wire,
  // and only the Time lane's pause stands it still. (test_e2e/transport.test.js covers the lanes.)
  await withQuirkPage(browser, { cols: [["X^t"]] }, async (page) => {
    await runToEnd(page, 1);
    await page.click("#qubits-button");
    await waitForPanel(page, "qubits", true);
    const chanceOfOne =
      '[data-panel-id="qubits"] [data-qubit="0"] .qubits-number';
    const read = () => page.$eval(chanceOfOne, (cell) => cell.textContent);
    const first = await page
      .waitForFunction(
        (selector) => document.querySelector(selector)?.textContent,
        { timeout: TEST_TIMEOUT_MILLIS },
        chanceOfOne,
      )
      .then((handle) => handle.jsonValue());
    await page.waitForFunction(
      (selector, was) => document.querySelector(selector)?.textContent !== was,
      { timeout: TEST_TIMEOUT_MILLIS },
      chanceOfOne,
      first,
    );

    await page.click("#time-play-button");
    await page.waitForFunction(
      () => document.getElementById("time-hold").textContent === "paused",
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const stood = await read();
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(await read(), stood, "A paused t must stand the gate still.");
  });
});

test("the qubits panel shows which qubits the circuit has entangled", async (browser) => {
  await withQuirkPage(browser, BELL, async (page) => {
    await page.click("#qubits-button");
    await waitForPanel(page, "qubits", true);
    const readPurities = () =>
      page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '[data-panel-id="qubits"] .qubits-purity',
          ),
        ].map((cell) => cell.textContent),
      );
    // At the start, before anything runs, both qubits are |0>, each in a state of its own.
    await page.click("#playhead-reset-button");
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-panel-id="qubits"] .qubits-purity')
          .length === 2 &&
        document
          .getElementById("playhead-position")
          .textContent.startsWith("operation 0"),
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    await page.waitForFunction(
      () =>
        [
          ...document.querySelectorAll(
            '[data-panel-id="qubits"] .qubits-purity',
          ),
        ].every((cell) => cell.textContent === "1.000"),
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    assert.deepEqual(await readPurities(), ["1.000", "1.000"]);

    await runToEnd(page);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[data-panel-id="qubits"] .qubits-mixed')]
          .length === 2,
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    assert.deepEqual(await readPurities(), ["0.500", "0.500"]);
  });
});

test("tensor factors are optional and coupled matrices stay whole", async (browser) => {
  await withQuirkPage(browser, BELL, async (page) => {
    await page.click("#algebra-button");
    await waitForPanel(page, "algebra", true);
    const operator =
      '[data-panel-id="algebra"] [data-step="1"] .operator-matrix';
    await page.waitForSelector(operator + " summary");
    assert.equal(
      await page.$$eval(operator + " mtable", (nodes) => nodes.length),
      1,
    );
    await page.$eval(operator + " summary", (e) => e.click());
    await page.waitForSelector(operator + " .tensor-product");
    assert.equal(
      await page.$$eval(operator + " mtable", (nodes) => nodes.length),
      3,
    );
    assert.equal(
      await page.$eval(
        operator + " mtable",
        (e) => e.querySelectorAll("mtr").length,
      ),
      4,
    );
    assert.ok(
      await page.$eval(operator + " .tensor-product", (e) =>
        e.textContent.includes("⊗"),
      ),
    );
    await page.waitForFunction(
      (selector) => {
        const figure = document.querySelector(selector);
        const matrix = figure
          .querySelector(".matrix-math")
          .getBoundingClientRect();
        const sign = figure.nextElementSibling.getBoundingClientRect();
        return (
          Math.abs(matrix.y + matrix.height / 2 - sign.y - sign.height / 2) < 4
        );
      },
      { timeout: TEST_TIMEOUT_MILLIS },
      operator,
    );
    assert.equal(
      await page.$$eval(
        '[data-step="2"] .operator-matrix summary',
        (nodes) => nodes.length,
      ),
      0,
    );
    assert.equal(
      await page.$$eval(
        '[data-step="2"] .state-factor:last-child summary',
        (nodes) => nodes.length,
      ),
      0,
    );
    await page.$eval(operator + " summary", (e) => e.click());
    await page.waitForFunction(
      (selector) =>
        document.querySelectorAll(selector + " mtable").length === 1,
      {},
      operator,
    );
  });
});

test("five-qubit algebra retains all written matrix entries", async (browser) => {
  await withQuirkPage(browser, { cols: [["inc5"]] }, async (page) => {
    await page.click("#algebra-button");
    await waitForPanel(page, "algebra", true);
    const selector = '[data-step="1"] .operator-matrix';
    await page.waitForSelector(selector + " mtable");
    assert.equal(
      await page.$$eval(selector + " mtr", (nodes) => nodes.length),
      32,
    );
    assert.equal(
      await page.$$eval(selector + " mtd", (nodes) => nodes.length),
      1024,
    );
    assert.equal(
      await page.$$eval(selector + " canvas", (nodes) => nodes.length),
      0,
    );
  });
});

test("browser preferred font size scales Forge explanations without changing circuit data", async (browser) => {
  await withQuirkPage(browser, BELL, async (page) => {
    const session = await page.createCDPSession();
    try {
      await session.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
      await page.reload();
      await waitForQuirk(page);
      await page.click("#gate-forge-button");
      await waitForPanel(page, "forge", true);
      await page.waitForSelector(".forge-panel .field-description", {
        visible: true,
      });
      const sizes = await page.evaluate(() => ({
        root: getComputedStyle(document.documentElement).fontSize,
        description: getComputedStyle(
          document.querySelector(".forge-panel .panel-description"),
        ).fontSize,
        field: getComputedStyle(
          document.querySelector(".forge-panel .field-description"),
        ).fontSize,
        role: document.documentElement.style.getPropertyValue("--text-small"),
        spacing: document.documentElement.style.getPropertyValue("--spacing"),
      }));
      assert.deepEqual(sizes, {
        root: "32px",
        description: "26px",
        field: "26px",
        role: "0.8125rem",
        spacing: "0.25rem",
      });
      const reflow = await page.evaluate(() => {
        const selectors = [
          "#playhead-reset-button",
          "#playhead-play-button",
          "#playhead-scrub",
          "#playhead-position",
        ];
        return {
          width: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
          controls: selectors.map((selector) => {
            const element = document.querySelector(selector);
            const rect = element?.getBoundingClientRect();
            return {
              selector,
              visible:
                !!rect &&
                rect.width > 0 &&
                rect.height > 0 &&
                rect.left >= 0 &&
                rect.right <= innerWidth,
            };
          }),
        };
      });
      assert.ok(
        reflow.width <= reflow.viewport,
        "Preferred text sizing must not widen the document.",
      );
      for (const control of reflow.controls)
        assert.ok(
          control.visible,
          `${control.selector} stays within the viewport.`,
        );
      await waitForCircuit(page, BELL);
    } finally {
      await session.send("Page.setFontSizes", { fontSizes: { standard: 16 } });
      await session.detach();
    }
  });
});

test("enlarged browser text keeps narrow touch transport within the layout viewport", async (browser) => {
  await withQuirkPage(browser, BELL, async (page) => {
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    const session = await page.createCDPSession();
    try {
      await session.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
      await page.reload();
      await waitForQuirk(page);
      const layout = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        controls: [
          "#playhead-reset-button",
          "#playhead-prev-button",
          "#playhead-play-button",
          "#playhead-next-button",
          "#playhead-end-button",
          "#breakpoint-toggle-button",
          "#playhead-scrub",
          "#playhead-position",
        ].map((selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return {
            selector,
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
          };
        }),
      }));
      assert.equal(layout.width, 390);
      assert.ok(
        layout.content <= layout.width,
        "Enlarged text must not expand the mobile layout viewport.",
      );
      for (const control of layout.controls) {
        assert.ok(
          control.left >= 0 &&
            control.right <= layout.width &&
            control.width > 0 &&
            control.height > 0,
          `${control.selector} stays reachable within the layout viewport.`,
        );
      }
      await waitForCircuit(page, BELL);
    } finally {
      await session.send("Page.setFontSizes", { fontSizes: { standard: 16 } });
      await session.detach();
    }
  });
});

test("reduced motion leaves short-landscape Forge fields and actions visible and scrollable", async (browser) => {
  await withQuirkPage(browser, BELL, async (page) => {
    await page.setViewport({
      width: 740,
      height: 360,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await page.reload();
    await waitForQuirk(page);
    await page.click("#gate-forge-button");
    await waitForPanel(page, "forge", true);
    await page.waitForSelector("#gate-forge-rotation-name", { visible: true });
    const visibility = await page.$eval(
      ".forge-panel .forge-method",
      (e) => getComputedStyle(e).visibility,
    );
    assert.equal(visibility, "visible");
    // Scroll the complete workflow to a field, then to its commit action; neither is clipped
    // behind a fixed header or footer when the panel has only a few vertical pixels available.
    for (const selector of [
      "#gate-forge-rotation-name",
      "#gate-forge-rotation-button",
    ]) {
      await page.$eval(selector, (e) => e.scrollIntoView({ block: "center" }));
      const reachable = await page.$eval(selector, (e) => {
        const r = e.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        return (
          r.width > 0 &&
          r.height > 0 &&
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          getComputedStyle(e).visibility === "visible" &&
          (hit === e || e.contains(hit))
        );
      });
      assert.ok(
        reachable,
        `${selector} can be reached by scrolling the short panel.`,
      );
    }
    await waitForCircuit(page, BELL);
  });
});
