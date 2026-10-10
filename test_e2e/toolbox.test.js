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

// The gate toolbox: search, tooltips, and the responsive reflow.

import assert from "node:assert/strict";
import {
  test,
  withQuirkPage,
  waitForQuirk,
  waitForCircuit,
  TEST_TIMEOUT_MILLIS,
  canvasLayout,
  assertCircuitLayout,
  waitForCanvasViewport,
  circuitMetrics,
  circuitTopForWires,
} from "./harness.js";

test("searches the toolbox, previews on hover, and opens accessible gate details", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"]] }, async (page) => {
    const shown = () =>
      page.evaluate(() => ({
        tiles: [...document.querySelectorAll(".gate-tile")]
          .filter((tile) => !tile.hidden)
          .map((tile) => tile.getAttribute("aria-label")),
        groups: [...document.querySelectorAll(".gate-group")]
          .filter((section) => !section.hidden)
          .map(
            (section) => section.querySelector(".gate-group-label").textContent,
          ),
        emptyShown: !document.getElementById("gate-toolbox-empty").hidden,
      }));

    // Every gate is reachable, and each tile carries a readable name rather than only a glyph.
    const all = await shown();
    assert.ok(
      all.tiles.length > 90,
      `The toolbox must hold every gate, saw ${all.tiles.length}.`,
    );
    assert.ok(all.tiles.includes("Hadamard Gate"));
    assert.equal(all.emptyShown, false);

    // The group headings name a group, they never hide one: no fold control, and no tile
    // list left hidden by a fold remembered from an earlier session.
    const headings = await page.evaluate(() => ({
      controls: document.querySelectorAll(".gate-group-label button").length,
      hiddenLists: [...document.querySelectorAll(".gate-group-tiles")].filter(
        (list) => list.hidden || getComputedStyle(list).display === "none",
      ).length,
    }));
    assert.deepEqual(headings, { controls: 0, hiddenLists: 0 });

    await page.click("#gate-search");
    await page.keyboard.type("qft");
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".gate-tile")].filter(
          (tile) => !tile.hidden,
        ).length === 2,
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    const filtered = await shown();
    assert.deepEqual(filtered.tiles, [
      "Fourier Transform Gate",
      "Inverse Fourier Transform Gate",
    ]);
    assert.deepEqual(filtered.groups, ["Frequency"]);

    // The hidden attribute must actually unrender the tile: an author display rule outranks
    // the browser's [hidden] styling, which once left non-matching tiles painted inside a
    // partially-matching group.
    const paintedButHidden = await page.evaluate(
      () =>
        [...document.querySelectorAll(".gate-tile")].filter(
          (tile) => tile.hidden && getComputedStyle(tile).display !== "none",
        ).length,
    );
    assert.equal(
      paintedButHidden,
      0,
      "Attribute-hidden tiles must not stay painted.",
    );

    // A search that matches nothing says so rather than showing an empty sidebar.
    await page.keyboard.type("zzzz");
    await page.waitForFunction(
      () => !document.getElementById("gate-toolbox-empty").hidden,
      { timeout: TEST_TIMEOUT_MILLIS },
    );

    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".gate-tile")].filter(
          (tile) => !tile.hidden,
        ).length > 90,
      { timeout: TEST_TIMEOUT_MILLIS },
    );

    // Hovering a tile brings up the gate's own documentation: its matrix written out, what it
    // does to each basis state, and the turn it performs.
    const tile = await page.evaluate(() => {
      const target = [...document.querySelectorAll(".gate-tile")].find(
        (e) => e.getAttribute("aria-label") === "Hadamard Gate",
      );
      // The gate list scrolls inside the sidebar, so the tile has to be brought into view
      // before its on-screen position means anything.
      target.scrollIntoView({ block: "center" });
      const bounds = target.getBoundingClientRect();
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
    });
    await page.mouse.move(tile.x, tile.y);
    await page.waitForSelector(".gate-hover", {
      visible: true,
      timeout: TEST_TIMEOUT_MILLIS,
    });
    assert.equal(
      await page.$(".gate-hover math"),
      null,
      "Hover stays a short summary.",
    );
    await page.click('[aria-label="Details for Hadamard Gate"]');
    await page.waitForSelector(".gate-details-popup", { visible: true });
    await page.waitForSelector(".gate-hover", { hidden: true });
    const card = await page.$eval(".gate-details-popup", (element) => ({
      title: element.querySelector(".gate-details-title").textContent,
      cells: element.querySelectorAll("math mtd").length,
      // Real typesetting, not glyphs: a stacked fraction over a radical.
      fractions: element.querySelectorAll("math mfrac").length,
      roots: element.querySelectorAll("math msqrt").length,
      mathHeight: Math.round(
        element.querySelector("math").getBoundingClientRect().height,
      ),
      actions: [...element.querySelectorAll(".gate-details-actions li")].map(
        (e) => e.textContent,
      ),
      axis: element.querySelector(".gate-details-facts dd")?.textContent,
      hasFigure: element.querySelector(".rotation-figure") !== null,
    }));
    assert.equal(card.title, "Hadamard Gate");
    assert.equal(
      card.cells,
      4,
      "The matrix must be written out, one element per entry.",
    );
    assert.equal(card.fractions, 4);
    assert.equal(card.roots, 4);
    // A stacked fraction is taller than a line of text; a glyph fallback would not be.
    assert.ok(
      card.mathHeight > 40,
      `The matrix must be typeset, saw ${card.mathHeight}px.`,
    );
    assert.deepEqual(card.actions, [
      "transforms |0⟩ into √½|0⟩ + √½|1⟩",
      "transforms |1⟩ into √½|0⟩ - √½|1⟩",
    ]);
    assert.ok(
      card.hasFigure,
      "A one-qubit gate must show the turn it performs.",
    );
    assert.ok(
      card.axis.startsWith("180°"),
      `The turn must be named, saw ${card.axis}.`,
    );
  });
});

test("opens interactive details for a gate too tall to write out", async (browser) => {
  // A custom gate built from a six-qubit circuit: its 64 x 64 matrix is never built whole.
  const TALL = {
    cols: [["~tall"]],
    gates: [
      { id: "~tall", name: "Tall", circuit: { cols: [["inc6"], ["H"]] } },
    ],
  };
  await withQuirkPage(browser, TALL, async (page) => {
    const tile = await page.evaluate(() => {
      const target = [...document.querySelectorAll(".gate-tile")].find(
        (e) => e.getAttribute("aria-label") === "Tall Gate [tall]",
      );
      target.scrollIntoView({ block: "center" });
      const bounds = target.getBoundingClientRect();
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
    });
    await page.mouse.move(tile.x, tile.y);
    await page.click('[aria-label="Details for Tall Gate [tall]"]');
    await page.waitForSelector(".gate-details-popup", {
      visible: true,
      timeout: TEST_TIMEOUT_MILLIS,
    });
    const card = await page
      .waitForFunction(
        () => {
          const view = document.querySelector(
            ".gate-details-popup .operator-view-canvas",
          );
          return view?.dataset.painted !== "true"
            ? false
            : {
                title: document.querySelector(
                  ".gate-details-popup .gate-details-title",
                ).textContent,
                label: view.getAttribute("aria-label"),
                note:
                  document.querySelector(
                    ".gate-details-popup .gate-details-note",
                  )?.textContent ?? null,
              };
        },
        { timeout: TEST_TIMEOUT_MILLIS },
      )
      .then((handle) => handle.jsonValue());
    assert.equal(card.title, "Tall Gate [tall]");
    assert.match(card.label, /64 by 64$/);
    assert.equal(
      card.note,
      null,
      "A tall gate must be drawn, not dismissed with a note.",
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.classList.contains("operator-view-canvas"),
      ),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      "Zoom in",
    );
    await page.keyboard.press("Enter");
    assert.equal(
      await page.$eval(
        '.gate-details-popup [aria-label="Zoom out"]',
        (e) => e.disabled,
      ),
      false,
    );
  });
});

test("places gates with the keyboard alone", async (browser) => {
  await withQuirkPage(browser, { cols: [["X"]] }, async (page) => {
    // The tiles share one tab stop; focusing a tile and pressing Enter appends its gate to
    // the end of the circuit, on the top wire.
    await page.evaluate(() => {
      [...document.querySelectorAll(".gate-tile")]
        .find((e) => e.getAttribute("aria-label") === "Hadamard Gate")
        .focus();
    });
    await page.keyboard.press("Enter");
    await waitForCircuit(page, { cols: [["X"], ["H"]] });

    // Focus survives the placement, so the arrow keys keep working: down one tile - the palette
    // opens on the half turns, H then X - and place that one too.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await waitForCircuit(page, { cols: [["X"], ["H"], ["X"]] });
  });
});

test("the palette, its gate cards and their figures follow the browser text size, with the rest of the chrome", async (browser) => {
  // A custom gate built from a six-qubit circuit, so a details popup draws an operator view.
  const circuit = {
    cols: [["H"]],
    gates: [
      { id: "~tall", name: "Tall", circuit: { cols: [["inc6"], ["H"]] } },
    ],
  };
  await withQuirkPage(
    browser,
    circuit,
    async (page) => {
      // The hover card and the details popup a tile opens, read from the Hadamard gate's.
      const cardSizes = async () => {
        // Over the chip, which sits at the tile's start: the middle of a tile wider than the
        // sidebar can fall under the sidebar's scrollbar.
        const tile = await page.evaluate(() => {
          const target = document.querySelector('.gate-tile[data-gate-id="H"]');
          target.scrollIntoView({ block: "center" });
          const bounds = target
            .querySelector(".gate-chip")
            .getBoundingClientRect();
          return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
          };
        });
        await page.mouse.move(tile.x, tile.y);
        await page.waitForSelector(".gate-hover", {
          visible: true,
          timeout: TEST_TIMEOUT_MILLIS,
        });
        const hover = await page.$eval(".gate-hover", (card) => ({
          title: getComputedStyle(card.querySelector(".gate-details-title"))
            .fontSize,
          blurb: getComputedStyle(card.querySelector(".gate-details-blurb"))
            .fontSize,
        }));
        // From the keyboard: a tile row can be wider than the sidebar, and the hover card lies
        // over the details button.
        await page.focus('[aria-label="Details for Hadamard Gate"]');
        await page.keyboard.press("Enter");
        await page.waitForSelector(".gate-details-popup", {
          visible: true,
          timeout: TEST_TIMEOUT_MILLIS,
        });
        const details = await page.$eval(".gate-details-popup", (popup) => {
          const size = (selector) =>
            getComputedStyle(popup.querySelector(selector)).fontSize;
          return {
            title: size(".gate-details-title"),
            heading: size(".gate-details-section h3"),
            caption: size(".matrix-factor > figcaption"),
            matrix: size(".matrix-math"),
            action: size(".gate-details-actions li"),
            facts: size(".gate-details-facts"),
            width: popup.getBoundingClientRect().width,
            figure: popup
              .querySelector(".rotation-figure")
              .getBoundingClientRect().width,
          };
        });
        return { hover, details };
      };
      // Closes the details popup that is open and opens the one for another gate.
      const openDetails = async (id) => {
        await page.keyboard.press("Escape");
        await page.waitForSelector(".gate-details-popup", {
          hidden: true,
          timeout: TEST_TIMEOUT_MILLIS,
        });
        const trigger = await page.evaluateHandle((id) => {
          const row = document
            .querySelector(`.gate-tile[data-gate-id="${id}"]`)
            .closest(".gate-tile-row");
          row.scrollIntoView({ block: "center" });
          return row.querySelector(".gate-details-trigger");
        }, id);
        await trigger.focus();
        await page.keyboard.press("Enter");
      };
      // The circuit the two-wire increment gate stands for, drawn in its details popup: the
      // figure's height, and how tall the drawing painted on it is.
      const circuitFigure = async () => {
        await openDetails("inc2");
        // The figure takes its host's width once the host is laid out, and draws at that width.
        const figure = await page.waitForFunction(
          () => {
            const host = document.querySelector(
              ".gate-details-popup .responsive-circuit-figure",
            );
            const canvas = host?.querySelector("canvas");
            if (
              !canvas ||
              canvas.width !== Math.floor(host.getBoundingClientRect().width)
            )
              return false;
            const copy = document.createElement("canvas");
            copy.width = canvas.width;
            copy.height = canvas.height;
            const context = copy.getContext("2d");
            context.drawImage(canvas, 0, 0);
            const data = context.getImageData(
              0,
              0,
              copy.width,
              copy.height,
            ).data;
            const background = data.slice(0, 3);
            const rows = [];
            for (let y = 0; y < copy.height; y++) {
              for (let x = 0; x < copy.width; x++) {
                const i = (y * copy.width + x) * 4;
                if (
                  [0, 1, 2].some(
                    (c) => Math.abs(data[i + c] - background[c]) > 24,
                  )
                ) {
                  rows.push(y);
                  break;
                }
              }
            }
            return rows.length === 0
              ? false
              : {
                  height: canvas.getBoundingClientRect().height,
                  painted: rows.at(-1) - rows[0],
                };
          },
          { timeout: TEST_TIMEOUT_MILLIS },
        );
        return figure.jsonValue();
      };
      // The operator view the tall gate's matrix is drawn in: its canvas on screen and in backing
      // pixels, and the readout under it.
      const operatorView = async () => {
        await openDetails("~tall");
        const view = await page.waitForFunction(
          () => {
            const canvas = document.querySelector(
              ".gate-details-popup .operator-view-canvas",
            );
            return canvas?.dataset.painted !== "true"
              ? false
              : {
                  canvas: [canvas.getBoundingClientRect().width, canvas.width],
                  readout: document
                    .querySelector(".gate-details-popup .operator-view-readout")
                    .getBoundingClientRect().width,
                };
          },
          { timeout: TEST_TIMEOUT_MILLIS },
        );
        return view.jsonValue();
      };
      const sizes = () =>
        page.evaluate(() => {
          const size = (selector) =>
            getComputedStyle(document.querySelector(selector)).fontSize;
          const chip = document
            .querySelector('.gate-tile[data-gate-id="X^½"] .gate-chip')
            .getBoundingClientRect();
          return {
            search: size("#gate-search"),
            heading: size(".gate-group-label"),
            name: size(".gate-tile-name"),
            symbol: size('.gate-tile[data-gate-id="X^½"] .gate-chip-symbol'),
            raised: size('.gate-tile[data-gate-id="X^½"] sup'),
            chip: [chip.width, chip.height],
            toolbar: size('.app-toolbar [data-slot="button"]'),
          };
        });
      // At the browser's usual 16px the palette and its cards are sized as they always were.
      assert.deepEqual(await sizes(), {
        search: "13px",
        heading: "11px",
        name: "13px",
        symbol: "14px",
        raised: "11px",
        chip: [48, 26],
        toolbar: "14px",
      });
      assert.deepEqual(await cardSizes(), {
        hover: { title: "16px", blurb: "13px" },
        details: {
          title: "16px",
          heading: "11px",
          caption: "13px",
          matrix: "16.8px",
          action: "14px",
          facts: "13px",
          width: 440,
          figure: 148,
        },
      });
      const usualCircuit = await circuitFigure();
      assert.equal(usualCircuit.height, 130);
      assert.deepEqual(await operatorView(), {
        canvas: [260, 260],
        readout: 260,
      });

      // Twice the text size in the browser's settings doubles the palette's text, each chip with its
      // symbol, and the cards' text with the details popup's width and its figures, drawn larger. The
      // toolbar is sized from the document root, which follows the browser, and doubles too. Chrome
      // applies the setting from the next page load.
      const session = await page.createCDPSession();
      await session.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
      await page.reload();
      await waitForQuirk(page);
      assert.deepEqual(await sizes(), {
        search: "26px",
        heading: "22px",
        name: "26px",
        symbol: "28px",
        raised: "22px",
        chip: [96, 52],
        toolbar: "28px",
      });
      assert.deepEqual(await cardSizes(), {
        hover: { title: "32px", blurb: "26px" },
        details: {
          title: "32px",
          heading: "22px",
          caption: "26px",
          matrix: "33.6px",
          action: "28px",
          facts: "26px",
          width: 880,
          figure: 296,
        },
      });
      // The circuit figure doubles, and so does the drawing on it. The drawing is shrunk to fit its
      // box, so a taller box alone would grow it too, but only until it reached its own size: at
      // this size that would stop it short of double.
      const largerCircuit = await circuitFigure();
      assert.equal(largerCircuit.height, 260);
      assert.ok(
        Math.abs(largerCircuit.painted / usualCircuit.painted - 2) < 0.05,
        `The circuit drawing must grow with the figure: ${usualCircuit.painted}px, then ${largerCircuit.painted}px.`,
      );
      // The operator view doubles too, drawn at its new size rather than stretched, and its
      // readout keeps its width.
      assert.deepEqual(await operatorView(), {
        canvas: [520, 520],
        readout: 520,
      });
      // A window with room for the chrome at twice its size, so the sidebar can bring a tile clear of
      // its sticky group heading.
    },
    { width: 1600, height: 1200, deviceScaleFactor: 1 },
  );
});

test("keeps the gate palette in the dock beside the circuit, where it cannot be closed", async (browser) => {
  const circuit = { cols: [["H"], ["Bloch"]] };
  await withQuirkPage(browser, circuit, async (page) => {
    const wideLayout = await canvasLayout(page);
    assertCircuitLayout(wideLayout);

    // The canvas is a fixed viewport: it fills its scroll cell exactly, and the circuit
    // centers inside it.
    await waitForCanvasViewport(page);
    // The redraw loop resizes the canvas from a ResizeObserver a frame or two after layout
    // settles, so wait for the match rather than sampling it once.
    const viewportMatch = await page
      .waitForFunction(
        () => {
          const cell = document.getElementById("canvasDiv");
          const canvas = document.querySelector("#drawCanvas canvas");
          return (
            canvas.width === cell.clientWidth &&
            canvas.height === cell.clientHeight
          );
        },
        { timeout: TEST_TIMEOUT_MILLIS },
      )
      .then(
        () => true,
        () => false,
      );
    assert.ok(viewportMatch, "The canvas must fill its scroll cell exactly.");

    // The palette is a dock panel of its own, in its own group to the circuit's left. Like the
    // circuit it is permanent, so neither tab offers to close. Permanent panels render in
    // dockview's overlay rather than inside their group, so groups are found through the tabs.
    const dock = await page.evaluate(() => {
      const tab = (title) =>
        [...document.querySelectorAll(".dv-tab")].find(
          (t) => t.textContent.trim() === title,
        );
      const bounds = (name) =>
        document
          .querySelector(`[data-panel-id="${name}"]`)
          .getBoundingClientRect();
      const tabs = [...document.querySelectorAll(".dv-tab")].map((t) => ({
        title: t.textContent.trim(),
        closable: t.querySelector(".dv-default-tab-action") !== null,
      }));
      return {
        separate:
          tab("Gates").closest(".dv-groupview") !==
          tab("Circuit").closest(".dv-groupview"),
        paletteLeft: bounds("gates").right <= bounds("circuit").left + 1,
        paletteWidth: Math.round(bounds("gates").width),
        tabs,
      };
    });
    assert.ok(
      dock.separate && dock.paletteLeft,
      "The palette must start beside the circuit, on its left.",
    );
    assert.ok(
      dock.paletteWidth >= 200 && dock.paletteWidth <= 280,
      `The palette must start at its own width, not half the dock; saw ${dock.paletteWidth}px.`,
    );
    assert.deepEqual(
      dock.tabs.filter((tab) => tab.closable),
      [],
      "Permanent panels must not offer to close.",
    );
    assert.deepEqual(dock.tabs.map((tab) => tab.title).sort(), [
      "Circuit",
      "Gates",
    ]);
  });
});

test("on a narrow screen the gate palette is a tab that gives way to the circuit when a gate is taken", async (browser) => {
  await withQuirkPage(
    browser,
    { cols: [] },
    async (page) => {
      // Below 920px a column of gates would squeeze the circuit, so the palette starts as a tab
      // behind it and the circuit keeps the whole width.
      const start = await page.evaluate(() => {
        const tab = (title) =>
          [...document.querySelectorAll(".dv-tab")].find(
            (t) => t.textContent.trim() === title,
          );
        return {
          sameGroup:
            tab("Gates").closest(".dv-groupview") ===
            tab("Circuit").closest(".dv-groupview"),
          circuitWidth: document
            .getElementById("canvasDiv")
            .getBoundingClientRect().width,
        };
      });
      assert.ok(
        start.sameGroup,
        "On a narrow screen the palette must share the circuit's group.",
      );
      assert.ok(
        start.circuitWidth > 690,
        `The circuit must keep the width, saw ${start.circuitWidth}px.`,
      );

      await waitForCanvasViewport(page);
      const canvasBounds = await page.$eval("#drawCanvas canvas", (element) => {
        const bounds = element.getBoundingClientRect();
        return { x: bounds.x, y: bounds.y };
      });
      const circuitTop = await circuitTopForWires(page, 2);

      const target = {
        x:
          canvasBounds.x +
          circuitMetrics.firstColumnLeft +
          circuitMetrics.gateSize / 2,
        y: canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2,
      };

      // Showing the palette's tab covers the circuit with it...
      const gatesTab = await page.evaluate(() => {
        const tab = [...document.querySelectorAll(".dv-tab")].find(
          (t) => t.textContent.trim() === "Gates",
        );
        const bounds = tab.getBoundingClientRect();
        return {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
        };
      });
      await page.mouse.click(gatesTab.x, gatesTab.y);
      // Both panels render "always", so a covered one keeps its layout: what counts is which is on
      // top, so the tile has to be the element under its own centre.
      const tile = await page
        .waitForFunction(
          () => {
            const target = [...document.querySelectorAll(".gate-tile")].find(
              (e) => e.getAttribute("aria-label") === "Hadamard Gate",
            );
            target.scrollIntoView({ block: "center" });
            const bounds = target.getBoundingClientRect();
            const centre = {
              x: bounds.x + bounds.width / 2,
              y: bounds.y + bounds.height / 2,
            };
            return document
              .elementFromPoint(centre.x, centre.y)
              ?.closest(".gate-tile") === target
              ? centre
              : false;
          },
          { timeout: TEST_TIMEOUT_MILLIS },
        )
        .then((handle) => handle.jsonValue());

      // ...and taking a gate brings the circuit back on top, so the drag can land on it.
      await page.mouse.move(tile.x, tile.y);
      await page.mouse.down();
      await page.mouse.move(tile.x + 12, tile.y);
      await page.waitForFunction(
        ({ x, y }) =>
          document.elementFromPoint(x, y)?.closest("#circuit-area") !== null,
        { timeout: TEST_TIMEOUT_MILLIS },
        target,
      );
      await page.mouse.move(target.x, target.y, { steps: 8 });
      await page.mouse.up();
      await waitForCircuit(page, { cols: [["H"]] });
    },
    { width: 700, height: 480, deviceScaleFactor: 1 },
  );
});

test("opens gate details by keyboard and restores focus without placing a gate", async (browser) => {
  await withQuirkPage(browser, { cols: [["X"]] }, async (page) => {
    await page.focus('[data-gate-id="H"]');
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      "Details for Hadamard Gate",
    );
    await page.keyboard.press("Enter");
    await page.waitForSelector(".gate-details-popup", { visible: true });
    assert.equal(
      await page.$eval(".gate-details-popup", (e) => e.getAttribute("role")),
      "dialog",
    );
    assert.equal(
      await page.$eval(
        ".gate-details-popup",
        (e) =>
          document.getElementById(e.getAttribute("aria-labelledby"))
            .textContent,
      ),
      "Hadamard Gate",
    );
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      "Close gate details",
    );
    await page.keyboard.press("Escape");
    await page.waitForSelector(".gate-details-popup", { hidden: true });
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      "Details for Hadamard Gate",
    );
    await waitForCircuit(page, { cols: [["X"]] });
    await page.keyboard.press("ArrowDown");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.classList.contains("gate-tile"),
      ),
      true,
    );
  });
});

test("opens and closes details by touch at phone width without horizontal popup overflow", async (browser) => {
  const circuit = {
    cols: [["~three"]],
    gates: [{ id: "~three", name: "Three", circuit: { cols: [["inc3"]] } }],
  };
  await withQuirkPage(
    browser,
    circuit,
    async (page) => {
      const tab = await page
        .waitForFunction(() => {
          const e = [...document.querySelectorAll(".dv-tab")].find(
            (t) => t.textContent.trim() === "Gates",
          );
          const r = e.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        })
        .then((h) => h.jsonValue());
      await page.touchscreen.tap(tab.x, tab.y);
      await page.tap("#gate-search");
      await page.keyboard.type("Three");
      // Wait until the dock has made the palette the hit-test target before tapping it.
      const point = await page
        .waitForFunction(() => {
          const e = document.querySelector(
            '[aria-label="Details for Three Gate [three]"]',
          );
          const r = e.getBoundingClientRect();
          const x = r.x + r.width / 2,
            y = r.y + r.height / 2;
          return document
            .elementFromPoint(x, y)
            ?.closest(".gate-details-trigger") === e
            ? { x, y }
            : false;
        })
        .then((h) => h.jsonValue());
      await page.touchscreen.tap(point.x, point.y);
      await page.waitForSelector(".gate-details-popup", { visible: true });
      await page.waitForFunction(() => {
        const e = document.querySelector(".gate-details-popup");
        const r = e.getBoundingClientRect();
        const v = visualViewport;
        return (
          r.left >= v.offsetLeft &&
          r.right <= v.offsetLeft + v.width &&
          r.top >= v.offsetTop &&
          r.bottom <= v.offsetTop + v.height &&
          e.scrollWidth <= e.clientWidth
        );
      });
      assert.equal(
        await page.$$eval(".gate-details-popup mtd", (cells) => cells.length),
        64,
      );
      const close = await page.$eval(
        '[aria-label="Close gate details"]',
        (e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        },
      );
      await page.touchscreen.tap(close.x, close.y);
      await page.waitForSelector(".gate-details-popup", { hidden: true });
      await waitForCircuit(page, circuit);
    },
    {
      width: 360,
      height: 640,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    },
  );
});

test("narrow palette clicks choose a deterministic cell and cancelled presses do not add", async (browser) => {
  const circuit = { cols: [["X"]] };
  await withQuirkPage(
    browser,
    circuit,
    async (page) => {
      const showGates = async () => {
        await page.click('.dv-tab[aria-label="Gates"]');
        await page.waitForFunction(() => {
          const tile = document.querySelector('[data-gate-id="H"]');
          const r = tile.getBoundingClientRect();
          return (
            document
              .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
              ?.closest(".gate-tile") === tile
          );
        });
      };
      await showGates();
      const tile = await page.$('[data-gate-id="H"]');
      const r = await tile.boundingBox();
      const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await waitForCircuit(page, circuit);
      assert.equal(
        await page.$eval('.dv-tab[aria-label="Gates"]', (e) =>
          e.getAttribute("aria-selected"),
        ),
        "true",
      );
      await page.mouse.up();
      await waitForCircuit(page, { cols: [["X"], ["H"]] });
      assert.equal(
        await page.$eval('.dv-tab[aria-label="Circuit"]', (e) =>
          e.getAttribute("aria-selected"),
        ),
        "true",
      );

      await showGates();
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.mouse.up();
      await waitForCircuit(page, { cols: [["X"], ["H"]] });
      assert.equal(
        await page.$eval('.dv-tab[aria-label="Gates"]', (e) =>
          e.getAttribute("aria-selected"),
        ),
        "true",
      );

      await page.focus('[data-gate-id="H"]');
      await page.keyboard.press("Space");
      await waitForCircuit(page, { cols: [["X"], ["H"], ["H"]] });
      assert.equal(
        await page.$eval('.dv-tab[aria-label="Circuit"]', (e) =>
          e.getAttribute("aria-selected"),
        ),
        "true",
      );
    },
    { width: 390, height: 844, deviceScaleFactor: 1 },
  );
});

test("touch swipes scroll gate rows without changing the circuit and a tap places once", async (browser) => {
  const circuit = { cols: [["X"]] };
  await withQuirkPage(
    browser,
    circuit,
    async (page) => {
      await page.tap('.dv-tab[aria-label="Gates"]');
      const point = await page
        .waitForFunction(() => {
          const tile = document.querySelector('[data-gate-id="H"]');
          const r = tile.getBoundingClientRect();
          return document
            .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
            ?.closest(".gate-tile") === tile
            ? { x: r.x + r.width / 2, y: r.y + r.height / 2 }
            : false;
        })
        .then((h) => h.jsonValue());
      // A continuous native touch gesture starts on the row, not the header or scrollbar.
      const touch = await page.touchscreen.touchStart(point.x, point.y);
      for (let distance = 20; distance <= 100; distance += 20) {
        await touch.move(point.x, point.y - distance);
      }
      await touch.end();
      await page.waitForFunction(
        () => document.querySelector(".gate-toolbox-viewport").scrollTop > 20,
      );
      await waitForCircuit(page, circuit);
      assert.equal(
        await page.$eval('.dv-tab[aria-label="Gates"]', (e) =>
          e.getAttribute("aria-selected"),
        ),
        "true",
      );

      // Search returns a stable tap target after scrolling; a tap uses the known append destination.
      await page.tap("#gate-search");
      await page.keyboard.type("hadamard");
      await page.$eval('[data-gate-id="H"]', (e) =>
        e.scrollIntoView({ block: "center" }),
      );
      await page.tap('[data-gate-id="H"]');
      await waitForCircuit(page, { cols: [["X"], ["H"]] });
      assert.equal(
        await page.$eval('.dv-tab[aria-label="Circuit"]', (e) =>
          e.getAttribute("aria-selected"),
        ),
        "true",
      );
    },
    {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    },
  );
});
