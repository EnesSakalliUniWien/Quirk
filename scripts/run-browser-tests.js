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

let browser;
let serve;
try {
  const pageFile = process.argv[2] || "test/test.html";
  if (
    pageFile !== "test/test.html" &&
    pageFile !== "test_perf/test_perf.html"
  ) {
    throw new Error(`Unsupported test page: ${pageFile}`);
  }

  browser = await puppeteer.launch();
  const page = await browser.newPage();
  let caughtPageError = false;
  page.on("console", (message) => console.log(message.text()));
  page.on("pageerror", (error) => {
    caughtPageError = true;
    console.error(
      "Page error bubbled into run-browser-tests.js: " + error.message,
    );
  });

  // Served over http rather than file://, because browsers refuse module scripts from disk.
  serve = await preview({
    root: path.join(import.meta.dirname, ".."),
    preview: { host: "127.0.0.1", port: 0, open: false },
  });
  await page.goto(new URL(pageFile, serve.resolvedUrls.local[0]).href);
  await page.waitForSelector("#done", { timeout: 5 * 60 * 1000 });
  const result = await page.evaluate(() => ({
    anyFailures: __any_failures,
    completed: __total_done,
    total: __total_tests,
  }));
  console.log(`Completed ${result.completed}/${result.total} tests.`);

  if (
    result.anyFailures ||
    caughtPageError ||
    result.total === 0 ||
    result.completed !== result.total
  ) {
    process.exitCode = 1;
  }
} catch (ex) {
  console.error("Error bubbled up into run-browser-tests.js: " + ex);
  process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } finally {
    await serve?.close();
  }
}
