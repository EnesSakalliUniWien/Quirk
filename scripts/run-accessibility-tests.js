// Scan the built app's desktop panels and mobile menus, then exercise keyboard editing.
import path from "node:path";

import { AxePuppeteer } from "@axe-core/puppeteer";
import puppeteer from "puppeteer";
import { preview } from "vite";

import {
  setAppOrigin,
  tests,
  withQuirkPage,
  waitForPanel,
} from "../test_e2e/harness.js";
import "../test_e2e/accessibility.test.js";

async function scan(page, name) {
  const { violations, incomplete } = await new AxePuppeteer(page).analyze();
  for (const violation of violations) {
    console.error(
      `FAIL ${name}: ${violation.id} (${violation.impact}): ${violation.help}`,
    );
    console.error(violation.helpUrl);
    for (const node of violation.nodes) {
      console.error(`  ${node.target.join(" -> ")}`);
      console.error(node.failureSummary);
    }
  }
  console.log(
    `Axe ${name}: ${violations.length} violations, ${incomplete.length} rules needing manual review.`,
  );
  for (const result of incomplete) {
    console.log(
      `REVIEW ${name}: ${result.id}: ${result.help} (${result.nodes.length} nodes)`,
    );
    // ARIA candidates need their selectors and reasons; contrast may contain hundreds of canvas nodes.
    if (result.id !== "color-contrast") {
      for (const node of result.nodes) {
        console.log(
          `  REVIEW ${node.target.join(" -> ")}: ${node.failureSummary}`,
        );
      }
    }
  }
  if (violations.length > 0) process.exitCode = 1;
}

let browser;
let serve;
try {
  serve = await preview({
    root: path.join(import.meta.dirname, ".."),
    preview: { host: "127.0.0.1", port: 0, open: false },
  });
  setAppOrigin(serve.resolvedUrls.local[0]);
  browser = await puppeteer.launch();
  const desktop = { width: 1600, height: 900, deviceScaleFactor: 1 };
  await withQuirkPage(
    browser,
    { cols: [["H"], ["X"]] },
    async (page) => {
      await scan(page, "desktop workspace");
    },
    desktop,
  );
  for (const [panel, button] of [
    ["forge", "gate-forge"],
    ["gate-param", "gate-parameter"],
    ["state", "state"],
    ["probabilities", "probabilities"],
    ["qubits", "qubits"],
    ["registers", "registers"],
    ["algebra", "algebra"],
    ["tape", "tape"],
    ["export", "export"],
  ]) {
    await withQuirkPage(
      browser,
      panel === "gate-param"
        ? { cols: [[{ id: "Rx", arg: "pi/2" }]] }
        : { cols: [["H"], ["X"]] },
      async (page) => {
        await page.click(`#${button}-button`);
        await waitForPanel(page, panel, true);
        await scan(page, `desktop ${panel}`);
        if (panel === "gate-param") {
          await page.click(".parameter-targets button");
          await page.waitForSelector("#gate-param-input", { visible: true });
          await scan(page, "desktop parameter editor");
        }
      },
      desktop,
    );
  }
  for (const [name, viewport] of [
    ["desktop", desktop],
    ["mobile", { width: 390, height: 844, hasTouch: true, isMobile: true }],
  ]) {
    await withQuirkPage(
      browser,
      { cols: [["H"], ["Bloch"]] },
      async (page) => {
        await page.focus("#canvasDiv");
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Enter");
        await waitForPanel(page, "bloch", true);
        await page.waitForSelector("#bloch-canvas", { visible: true });
        await scan(page, `${name} Bloch analyzer`);
      },
      viewport,
    );
  }
  await withQuirkPage(
    browser,
    { cols: [["H"]] },
    async (page) => {
      await scan(page, "mobile workspace");
      await page.click("#inspect-button");
      await page.waitForSelector('[role="menu"]', { visible: true });
      await scan(page, "mobile Inspect menu");
      await page.keyboard.press("Escape");
      await page.click("#toolbar-more-button");
      await page.waitForSelector('[role="menu"]', { visible: true });
      await scan(page, "mobile More menu");
    },
    {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    },
  );

  // These are the same tests the end-to-end runner uses: no separate keyboard simulation.
  for (const { name, body } of tests.filter(
    ({ name }) =>
      name.includes("keyboard alone") ||
      name.includes("first gate") ||
      name.includes("toolbar keyboard"),
  )) {
    await body(browser);
    console.log(`PASS ${name}`);
  }
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } finally {
    await serve?.close();
  }
}
