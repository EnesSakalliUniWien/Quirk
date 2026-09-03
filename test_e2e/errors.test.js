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

// The error banner: recoveries surface over the circuit without breaking the app.

import assert from 'node:assert/strict';
import {test, withQuirkPage, waitForQuirk, urlForCircuit, TEST_TIMEOUT_MILLIS} from './harness.js';

const RECOVERY_CONSOLE_LINE = [/Recovered from unexpected error/];

async function bannerState(page) {
    return page.evaluate(() => {
        const banner = document.getElementById('error-banner');
        const message = document.getElementById('error-banner-message');
        return {
            visible: banner !== null && !banner.hidden,
            role: message === null ? undefined : message.getAttribute('role'),
            text: message === null ? '' : message.textContent,
        };
    });
}

test('recovers from a mangled circuit URL with a dismissible banner', async browser => {
    await withQuirkPage(browser, {cols: []}, async page => {
        const mangled = new URL(urlForCircuit({cols: []}));
        mangled.hash = 'circuit=%7Bnot-json';
        await page.goto(mangled.href);
        await waitForQuirk(page);

        await page.waitForFunction(
            () => document.getElementById('error-banner') !== null,
            {timeout: TEST_TIMEOUT_MILLIS});
        const banner = await bannerState(page);
        assert.equal(banner.visible, true);
        assert.equal(banner.role, 'alert');
        assert.ok(
            banner.text.startsWith('Defaulted to an empty circuit'),
            `Unexpected banner text: ${banner.text}`);

        // The app recovered: the circuit area is alive and interactive.
        assert.notEqual(await page.$('#drawCanvas'), null);

        await page.click('.error-banner-dismiss');
        assert.equal((await bannerState(page)).visible, false);
    }, undefined, RECOVERY_CONSOLE_LINE);
});

test('recovers from an unknown gate id with a parse-error banner', async browser => {
    await withQuirkPage(browser, {cols: [['NOT_A_GATE']]}, async page => {
        await page.waitForFunction(
            () => document.getElementById('error-banner') !== null,
            {timeout: TEST_TIMEOUT_MILLIS});
        const banner = await bannerState(page);
        assert.equal(banner.visible, true);
        assert.ok(
            banner.text.startsWith("Defaulted to a do-nothing 'parse error' gate"),
            `Unexpected banner text: ${banner.text}`);
    }, undefined, RECOVERY_CONSOLE_LINE);
});
