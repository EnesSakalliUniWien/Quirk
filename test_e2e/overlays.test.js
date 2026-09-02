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

test('edits a rotation gate angle through the parameter dialog', async browser => {
    await withQuirkPage(browser, {cols: [[{id: 'Rx', arg: 'pi/2'}]]}, async page => {
        const canvasBounds = await page.$eval('#drawCanvas', element => {
            const bounds = element.getBoundingClientRect();
            return {x: bounds.x, y: bounds.y};
        });

        // The change button is the bottom half of the gate in the first column on the first wire.
        await page.mouse.move(canvasBounds.x + 77, canvasBounds.y + 62);
        await page.mouse.down();
        await page.mouse.up();
        await waitForDialog(page, '#gate-param-div', true);
        await page.waitForFunction(
            () => document.activeElement?.id === 'gate-param-input',
            {timeout: TEST_TIMEOUT_MILLIS});

        // Focusing selects the current value, so typing replaces it; Enter applies.
        await page.keyboard.type('3pi/4');
        await page.keyboard.press('Enter');
        await waitForDialog(page, '#gate-param-div', false);
        await waitForCircuit(page, {cols: [[{id: 'Rx', arg: '3pi/4'}]]});
    });
});

test('lists the shortcuts in the menu', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        await page.click('#menu-button');
        await waitForDialog(page, '#menu-div', true);
        const shortcuts = await page.$$eval('.shortcut-list dd', elements => elements.map(e => e.textContent));
        assert.ok(shortcuts.length >= 8, `The shortcut list must be filled in, saw ${shortcuts.length}.`);
        assert.ok(shortcuts.includes('Undo'));
        assert.ok(shortcuts.includes('Play or pause the animation'));
    });
});
