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

// Runs the end-to-end specs in test_e2e/ against the built out/quirk.html. Importing a spec
// registers its tests with the harness; the loop below runs the registry.

import path from 'node:path';

import puppeteer from 'puppeteer';

import {startStaticServer} from './server/staticServer.js';
import {tests, setAppOrigin} from './test_e2e/harness.js';
import './test_e2e/circuit.test.js';
import './test_e2e/toolbar.test.js';
import './test_e2e/overlays.test.js';
import './test_e2e/transport.test.js';
import './test_e2e/toolbox.test.js';
import './test_e2e/errors.test.js';

let browser;
let serve;
let completed = 0;
try {
    // Served over http rather than file://, because browsers refuse module scripts from disk.
    serve = await startStaticServer({root: path.join(import.meta.dirname, 'out')});
    setAppOrigin(serve.origin);
    browser = await puppeteer.launch();
    console.log(`Running ${tests.length} end-to-end tests...`);
    for (const {name, body} of tests) {
        try {
            await body(browser);
            completed++;
            console.log(`PASS ${name}`);
        } catch (error) {
            console.error(`FAIL ${name}`);
            console.error(error.stack || error);
            process.exitCode = 1;
        }
    }
    console.log(`Completed ${completed}/${tests.length} end-to-end tests.`);
    if (completed !== tests.length) {
        process.exitCode = 1;
    }
} catch (error) {
    console.error('Error bubbled up into PuppeteerRunEndToEndTests.js: ' + error.stack);
    process.exitCode = 1;
} finally {
    if (browser !== undefined) {
        await browser.close();
    }
    if (serve !== undefined) {
        await serve.close();
    }
}
