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

// The circuit area: loading from a URL, drag editing, and history.

const assert = require('node:assert/strict');
const {test, withQuirkPage, waitForQuirk, waitForCircuit, waitForDialog, currentCircuit, exportedCircuit, urlForCircuit, TEST_TIMEOUT_MILLIS, canvasLayout, assertCircuitLayout} = require('./harness.js');

test('loads a URL circuit and renders its Bloch sphere in the circuit area', async browser => {
    const circuit = {cols: [['H'], ['Bloch']]};
    await withQuirkPage(browser, circuit, async page => {
        // The menu dialog unmounts entirely while closed.
        assert.equal(await page.$('#menu-div'), null);
        assert.deepEqual(await exportedCircuit(page), circuit);
        assertCircuitLayout(await canvasLayout(page));
    });
});

test('drags a gate onto a wire and supports undo, redo, and clear actions', async browser => {
    await withQuirkPage(browser, {cols: []}, async page => {
        await page.click('#close-menu-button');

        const canvasBounds = await page.$eval('#drawCanvas', element => {
            const bounds = element.getBoundingClientRect();
            return {x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height};
        });
        const halfTurnH = await page.evaluate(() => {
            const tile = [...document.querySelectorAll('.gate-tile')].
                find(e => e.getAttribute('aria-label') === 'Hadamard Gate');
            // The gate list scrolls inside the sidebar, so the tile has to be brought into view
            // before its on-screen position means anything.
            tile.scrollIntoView({block: 'center'});
            const bounds = tile.getBoundingClientRect();
            return {x: bounds.x + bounds.width/2, y: bounds.y + bounds.height/2};
        });
        const firstWireFirstColumn = {
            x: canvasBounds.x + 55,
            y: canvasBounds.y + 24 + 25
        };

        await page.mouse.move(halfTurnH.x, halfTurnH.y);
        await page.mouse.down();
        await page.mouse.move(firstWireFirstColumn.x, firstWireFirstColumn.y, {steps: 10});
        await page.mouse.up();

        const circuitWithH = {cols: [['H']]};
        const emptyCircuit = {cols: []};
        await waitForCircuit(page, circuitWithH);
        assert.equal(await page.$eval('#undo-button', button => button.disabled), false);
        assert.equal(await page.$eval('#redo-button', button => button.disabled), true);

        await page.click('#undo-button');
        await waitForCircuit(page, emptyCircuit);
        assert.equal(await page.$eval('#redo-button', button => button.disabled), false);

        await page.click('#redo-button');
        await waitForCircuit(page, circuitWithH);

        await page.click('#clear-circuit-button');
        await waitForCircuit(page, emptyCircuit);

        await page.click('#undo-button');
        await waitForCircuit(page, circuitWithH);
        await page.click('#clear-all-button');
        await waitForCircuit(page, emptyCircuit);
        assert.deepEqual(await currentCircuit(page), emptyCircuit);
    });
});

test('undoes and redoes with both the control and command modifiers', async browser => {
    const circuitWithH = {cols: [['H']]};
    const emptyCircuit = {cols: []};
    await withQuirkPage(browser, circuitWithH, async page => {
        // Command is the primary modifier on macOS; control is the primary modifier elsewhere.
        for (const modifier of ['Meta', 'Control']) {
            await page.click('#clear-circuit-button');
            await waitForCircuit(page, emptyCircuit);

            await page.keyboard.down(modifier);
            await page.keyboard.press('KeyZ');
            await page.keyboard.up(modifier);
            await waitForCircuit(page, circuitWithH);

            await page.keyboard.down(modifier);
            await page.keyboard.down('Shift');
            await page.keyboard.press('KeyZ');
            await page.keyboard.up('Shift');
            await page.keyboard.up(modifier);
            await waitForCircuit(page, emptyCircuit);
        }
    });
});
