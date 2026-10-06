// Selecting part of the circuit with a box, and copying, cutting, deleting and pasting it.

import assert from "node:assert/strict";
import {
  test,
  withQuirkPage,
  waitForCircuit,
  waitForPanel,
  waitForCanvasViewport,
  circuitTopForWires,
  circuitMetrics,
  currentCircuit,
  TEST_TIMEOUT_MILLIS,
} from "./harness.js";

const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

/** The centre of a cell of the circuit, in page coordinates. */
async function cellCentre(page, wireCount, col, row) {
  await waitForCanvasViewport(page);
  const canvas = await page.$eval("#drawCanvas canvas", (element) => {
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y };
  });
  const top = await circuitTopForWires(page, wireCount);
  return {
    x:
      canvas.x +
      circuitMetrics.firstColumnLeft +
      col * circuitMetrics.columnSpacing +
      circuitMetrics.gateSize / 2,
    y:
      canvas.y +
      top +
      row * circuitMetrics.wireSpacing +
      circuitMetrics.wireSpacing / 2,
  };
}

async function dragBox(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.mouse.up();
}

async function selectionSize(page) {
  const bar = await page.waitForSelector(".selection-bar-size", {
    timeout: TEST_TIMEOUT_MILLIS,
  });
  return bar.evaluate((e) => e.textContent);
}

async function waitForNoSelection(page) {
  await page.waitForFunction(
    () => document.querySelector(".selection-bar") === null,
    { timeout: TEST_TIMEOUT_MILLIS },
  );
}

async function command(page, key) {
  await page.keyboard.down(COMMAND);
  await page.keyboard.press(key);
  await page.keyboard.up(COMMAND);
}

/** Replaces the async clipboard's writer, so a copy can be read back without clipboard permission. */
async function recordClipboard(page) {
  await page.evaluate(() => {
    window.__copied = [];
    navigator.clipboard.writeText = async (text) => {
      window.__copied.push(text);
    };
  });
}

/** Pastes as the browser does: a paste event carrying the text. */
async function paste(page, text) {
  await page.evaluate((text) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", text);
    document.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, text);
}

test("a box dragged from an empty part of the circuit selects whole gates, and edits nothing", async (browser) => {
  const circuit = { cols: [["H"], [1, "X"]] };
  await withQuirkPage(browser, circuit, async (page) => {
    await dragBox(
      page,
      await cellCentre(page, 2, 1, 0),
      await cellCentre(page, 2, 1, 1),
    );
    assert.equal(await selectionSize(page), "1 column × 2 wires");
    assert.deepEqual(await currentCircuit(page), circuit);

    // Escape lets it go; so does a click on an empty part of the circuit.
    await page.keyboard.press("Escape");
    await waitForNoSelection(page);
    await dragBox(
      page,
      await cellCentre(page, 2, 1, 0),
      await cellCentre(page, 2, 0, 0),
    );
    assert.equal(await selectionSize(page), "2 columns × 1 wire");
    const empty = await cellCentre(page, 2, 0, 1);
    await page.mouse.click(empty.x, empty.y);
    await waitForNoSelection(page);

    // A press on a gate still grabs the gate.
    await dragBox(
      page,
      await cellCentre(page, 2, 0, 0),
      await cellCentre(page, 2, 0, 1),
    );
    await waitForCircuit(page, {
      cols: [
        [1, "H"],
        [1, "X"],
      ],
    });
    assert.equal(await page.$(".selection-bar"), null);
  });
});

test("copy, paste, delete and cut act on the selection by key, each edit one commit", async (browser) => {
  await withQuirkPage(browser, { cols: [["H"], [1, "X"]] }, async (page) => {
    await recordClipboard(page);
    await dragBox(
      page,
      await cellCentre(page, 2, 1, 0),
      await cellCentre(page, 2, 1, 1),
    );
    await command(page, "KeyC");
    await page.waitForFunction(() => window.__copied.length === 1, {
      timeout: TEST_TIMEOUT_MILLIS,
    });
    const copied = await page.evaluate(() => window.__copied[0]);
    assert.deepEqual(JSON.parse(copied), { cols: [[1, "X"]] });
    await page.waitForFunction(
      () =>
        document
          .querySelector(".app-toast")
          ?.textContent.includes("Copied 1 column × 2 wires"),
      { timeout: TEST_TIMEOUT_MILLIS },
    );

    // With the pointer off the circuit, a paste goes after the selection, and is selected.
    await page.mouse.move(2, 2);
    await paste(page, copied);
    await waitForCircuit(page, { cols: [["H"], [1, "X"], [1, "X"]] });
    assert.equal(await selectionSize(page), "1 column × 2 wires");

    // Delete takes the pasted gates away again; undo brings them back.
    await page.keyboard.press("Backspace");
    await waitForCircuit(page, { cols: [["H"], [1, "X"]] });
    await waitForNoSelection(page);
    await page.click("#undo-button");
    await waitForCircuit(page, { cols: [["H"], [1, "X"], [1, "X"]] });

    // Select all, then cut: the circuit empties and the clipboard holds all of it.
    await page.focus("#canvasDiv");
    await command(page, "KeyA");
    assert.equal(await selectionSize(page), "3 columns × 2 wires");
    await command(page, "KeyX");
    await waitForCircuit(page, { cols: [] });
    assert.deepEqual(
      JSON.parse(await page.evaluate(() => window.__copied.at(-1))),
      { cols: [["H"], [1, "X"], [1, "X"]] },
    );

    // Text that is not a circuit is not taken.
    await paste(page, "hello");
    assert.deepEqual(await currentCircuit(page), { cols: [] });
  });
});

test("the selection menu and bar copy, delete and make a gate of the selection", async (browser) => {
  await withQuirkPage(browser, { cols: [["H", "X"], ["Z"]] }, async (page) => {
    await recordClipboard(page);
    await dragBox(
      page,
      await cellCentre(page, 2, 1, 1),
      await cellCentre(page, 2, 0, 0),
    );
    assert.equal(await selectionSize(page), "2 columns × 2 wires");

    // A right click on an empty part of the selection opens its menu.
    const inside = await cellCentre(page, 2, 1, 1);
    await page.mouse.click(inside.x, inside.y, { button: "right" });
    const copy = await page.waitForSelector(
      '.selection-menu [data-action="copy"]',
      { timeout: TEST_TIMEOUT_MILLIS },
    );
    await copy.click();
    await page.waitForFunction(() => window.__copied.length === 1, {
      timeout: TEST_TIMEOUT_MILLIS,
    });
    assert.deepEqual(
      JSON.parse(await page.evaluate(() => window.__copied[0])),
      { cols: [["H", "X"], ["Z"]] },
    );

    // Create gate from selection: the forge opens on its Circuit tab with the selection's ranges.
    await page.click('.selection-bar [data-action="make-gate"]');
    await waitForPanel(page, "forge", true);
    await page.waitForFunction(
      () =>
        document.getElementById("gate-forge-circuit-cols")?.value === "1:2" &&
        document.getElementById("gate-forge-circuit-rows")?.value === "1:2",
      { timeout: TEST_TIMEOUT_MILLIS },
    );

    await page.click('.selection-bar [data-action="delete"]');
    await waitForCircuit(page, { cols: [] });
  });
});
