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

// Dragging a dialog header into a snap zone docks it, which also makes it non-modal.

import assert from 'node:assert/strict';

import {test, withQuirkPage, waitForCanvasViewport, circuitTopForWires} from './harness.js';

async function openBlochDialog(page) {
    const canvasBounds = await page.$eval('#drawCanvas', element => {
        const bounds = element.getBoundingClientRect();
        return {x: bounds.x, y: bounds.y};
    });
    let opened = false;
    for (let attempt = 0; attempt < 3 && !opened; attempt++) {
        await waitForCanvasViewport(page);
        const circuitTop = await circuitTopForWires(page, 2);
        await page.mouse.click(canvasBounds.x + 50 + 32 + 20, canvasBounds.y + circuitTop + 25);
        opened = await page.waitForSelector('#bloch-div', {visible: true, timeout: 2000}).
            then(() => true, () => false);
    }
    assert.ok(opened, 'The Bloch sphere dialog must open.');
}

async function dragHeaderTo(page, x, y) {
    const header = await page.$eval('#bloch-div [data-snap-handle]', element => {
        const bounds = element.getBoundingClientRect();
        return {x: bounds.x + bounds.width / 2, y: bounds.y + 10};
    });
    await page.mouse.move(header.x, header.y);
    await page.mouse.down();
    await page.mouse.move((header.x + x) / 2, (header.y + y) / 2, {steps: 5});
    await page.mouse.move(x, y, {steps: 5});
    await page.mouse.up();
}

test('docks the Bloch view to the right and keeps the circuit editable', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Bloch']]}, async page => {
        await openBlochDialog(page);
        const viewport = page.viewport();

        const widthBefore = await page.$eval('#bloch-canvas', e => e.getBoundingClientRect().width);
        await dragHeaderTo(page, viewport.width - 5, viewport.height / 2);

        await page.waitForFunction(
            () => document.getElementById('bloch-div').dataset.docked === 'right',
            {timeout: 2000});
        assert.equal(await page.$('.dialog-overlay'), null,
            'A docked dialog must not render the modal backdrop.');
        const widthAfter = await page.$eval('#bloch-canvas', e => e.getBoundingClientRect().width);
        assert.notEqual(widthBefore, widthAfter, 'Docking must resize the Bloch canvas.');

        // The circuit stays interactive: click the canvas area and confirm focus can reach it.
        const dockedLeftEdge = await page.$eval('#bloch-div', e => e.getBoundingClientRect().x);
        await page.mouse.click(dockedLeftEdge / 2, viewport.height / 2);
        const canvasFocusable = await page.$eval('#canvasDiv', e => e.tabIndex);
        assert.equal(canvasFocusable, 0, 'The canvas must stay focusable while docked.');

        // Dragging back out restores modality.
        await dragHeaderTo(page, viewport.width / 2, viewport.height / 2);
        await page.waitForFunction(
            () => document.getElementById('bloch-div').dataset.docked === undefined,
            {timeout: 2000});
        assert.notEqual(await page.$('.dialog-overlay'), null,
            'An undocked dialog must be modal again.');
    });
});
