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

// The menu, export, and gate forge dialogs.

const assert = require('node:assert/strict');
const {test, withQuirkPage, waitForQuirk, waitForCircuit, waitForDialog, currentCircuit, exportedCircuit, urlForCircuit, TEST_TIMEOUT_MILLIS} = require('./harness.js');

test('opens and closes the menu, export, and gate forge overlays', async browser => {
    const circuit = {cols: [['H']]};
    await withQuirkPage(browser, circuit, async page => {
        await page.click('#menu-button');
        await waitForDialog(page, '#menu-div', true);
        assert.equal(await page.$eval('#export-button', button => button.disabled), true);
        await page.keyboard.press('Escape');
        await waitForDialog(page, '#menu-div', false);

        await page.click('#export-button');
        await waitForDialog(page, '#export-div', true);
        const jsonText = await page.$eval('#export-circuit-json-pre', element => element.textContent);
        assert.deepEqual(JSON.parse(jsonText), circuit);
        await page.keyboard.press('Escape');
        await waitForDialog(page, '#export-div', false);
        assert.equal(await page.$eval('#menu-button', button => button.disabled), false);

        await page.click('#gate-forge-button');
        await waitForDialog(page, '#gate-forge-div', true);
        const forge = await page.$eval('.forge-dialog', element => ({
            title: element.querySelector('.dialog-title')?.textContent,
            methodCount: element.querySelectorAll('.forge-method').length
        }));
        assert.equal(forge.title, 'Make a gate');
        assert.equal(forge.methodCount, 3);
        // The dialog moves focus asynchronously after it opens.
        await page.waitForFunction(
            () => document.activeElement?.id === 'gate-forge-rotation-axis',
            {timeout: TEST_TIMEOUT_MILLIS});
        await page.keyboard.press('Escape');
        await waitForDialog(page, '#gate-forge-div', false);
    });
});

/**
 * The amber the playhead band paints across one column, counted over the strip between the two
 * wire rows. Gate boxes stop at the rows, so that strip is band or background and nothing else.
 */
