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

import path from "node:path";

import puppeteer from "puppeteer";

import { preview } from "vite";

import { waitForQuirk } from "../test_e2e/harness.js";

let browser;
let serve;
try {
  // Served over http rather than file://, because browsers refuse module scripts from disk.
  serve = await preview({
    root: path.join(import.meta.dirname, ".."),
    preview: { host: "127.0.0.1", port: 0, open: false },
  });
  browser = await puppeteer.launch();
  const page = await browser.newPage();
  let caughtPageError = false;
  page.on("console", (message) => console.log(message.text()));
  page.on("pageerror", ({ message }) => {
    caughtPageError = true;
    console.error("Page error bubbled into screenshot-circuit.js: " + message);
  });
  const circuitJson =
    '{"cols":[["H"],["Bloch"],["Amps1"],[],["Density"],["•","X"],["Chance2"]]}';
  await page.goto(`${serve.resolvedUrls.local[0]}#circuit=` + circuitJson);
  await waitForQuirk(page);
  await page.screenshot({ path: "screenshot.png" });
  if (caughtPageError) {
    process.exitCode = 1;
  }
} catch (ex) {
  console.error("Error bubbled up into screenshot-circuit.js: " + ex);
  process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } finally {
    await serve?.close();
  }
}
