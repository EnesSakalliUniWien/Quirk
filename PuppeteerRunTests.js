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

import path from 'node:path';

import puppeteer from 'puppeteer';

import {startStaticServer} from './server/staticServer.js';

let browser;
let serve;
try {
    const pageFile = process.argv[2] || 'test.html';
    if (pageFile !== 'test.html' && pageFile !== 'test_perf.html') {
        throw new Error(`Unsupported test page: ${pageFile}`);
    }

    browser = await puppeteer.launch();
    const page = await browser.newPage();
    let caughtPageError = false;
    page.on('console', message => console.log(message.text()));
    page.on('pageerror', error => {
        caughtPageError = true;
        console.error("Page error bubbled into PuppeteerRunTests.js: " + error.message);
    });

    // Served over http rather than file://, because browsers refuse module scripts from disk.
    serve = await startStaticServer({root: path.join(import.meta.dirname, 'out')});
    await page.goto(`${serve.origin}/${pageFile}`);
    await page.waitForSelector('#done', {timeout: 5 * 60 * 1000});
    const result = await page.evaluate(() => ({
        anyFailures: __any_failures,
        completed: __total_done,
        total: __total_tests
    }));
    console.log(`Completed ${result.completed}/${result.total} tests.`);

    if (result.anyFailures || caughtPageError || result.total === 0 || result.completed !== result.total) {
        process.exitCode = 1;
    }
} catch (ex) {
    console.error("Error bubbled up into PuppeteerRunTests.js: " + ex);
    process.exitCode = 1;
} finally {
    if (browser !== undefined) {
        await browser.close();
    }
    if (serve !== undefined) {
        await serve.close();
    }
}
