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

// The panels the circuit and the toolbar open: export, gate forge, gate parameter, Bloch.

import assert from 'node:assert/strict';
import {circuitMetrics, test, withQuirkPage, waitForCircuit, waitForPanel, closePanel, TEST_TIMEOUT_MILLIS, circuitTopForWires, waitForCanvasViewport} from './harness.js';

test('opens a Bloch sphere from its enlarged edge at different zoom levels', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Bloch']]}, async page => {
        for (const [button, zoom] of [['Zoom out', 0.8], ['Zoom in', 1.25]]) {
            await page.click('[aria-label="Reset zoom"]');
            await page.click(`[aria-label="${button}"]`);
            // Zoom preserves the viewport centre and can scroll the first columns out of view.
            await page.$eval('#canvasDiv', element => element.scrollTo({left: 0, top: 0, behavior: 'instant'}));
            await waitForCanvasViewport(page);
            const top = await circuitTopForWires(page, 2, zoom);
            const canvas = await page.$eval('#drawCanvas', element => {
                const rect = element.getBoundingClientRect();
                return {x: rect.x, y: rect.y};
            });
            // This point is inside the enlarged sphere but outside the ordinary gate rectangle.
            const x = circuitMetrics.firstColumnLeft + circuitMetrics.columnSpacing +
                circuitMetrics.gateSize / 2 + circuitMetrics.blochRadius * 0.9;
            await page.mouse.click(canvas.x + x * zoom,
                canvas.y + (top + circuitMetrics.wireSpacing / 2) * zoom);
            await waitForPanel(page, 'bloch', true);
            await closePanel(page, 'bloch');
        }
    });
});

test('opens and closes the export and gate forge panels', async browser => {
    const circuit = {cols: [['H']]};
    await withQuirkPage(browser, circuit, async page => {
        await page.click('#export-button');
        // An open panel never disables the app: the rest of the chrome keeps working around it.
        assert.equal(await page.$eval('#gate-forge-button', button => button.disabled), false);
        await waitForPanel(page, 'export', true);
        const jsonText = await page.$eval('#export-circuit-json-pre', element => element.textContent);
        assert.deepEqual(JSON.parse(jsonText), circuit);
        // The offline-copy quine is gone; the panel must not offer the download any more.
        assert.equal(await page.$('#download-offline-copy-button'), null);
        await closePanel(page, 'export');

        await page.click('#gate-forge-button');
        await waitForPanel(page, 'forge', true);
        const forge = await page.$eval('.forge-panel', element => ({
            title: element.querySelector('.panel-title')?.textContent,
            methodCount: element.querySelectorAll('.forge-method').length
        }));
        assert.equal(forge.title, 'Make a gate');
        assert.equal(forge.methodCount, 3);
        await closePanel(page, 'forge');
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
        // The state table fills in asynchronously and can shift the centered circuit between the
        // position sample and the click, so retry until the dialog actually opens.
        let opened = false;
        for (let attempt = 0; attempt < 3 && !opened; attempt++) {
            await waitForCanvasViewport(page);
            const circuitTop = await circuitTopForWires(page, 2);
            await page.mouse.move(canvasBounds.x + circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2, canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2 + 13);
            await page.mouse.down();
            await page.mouse.up();
            opened = await page.waitForSelector('[data-panel-id="gate-param"]', {visible: true, timeout: 2000}).
                then(() => true, () => false);
        }
        assert.ok(opened, 'The parameter panel must open.');
        await page.waitForFunction(
            () => document.activeElement?.id === 'gate-param-input',
            {timeout: TEST_TIMEOUT_MILLIS});

        // Focusing selects the current value, so typing replaces it; Enter applies.
        await page.keyboard.type('3pi/4');
        await page.keyboard.press('Enter');
        await waitForPanel(page, 'gate-param', false);
        await waitForCircuit(page, {cols: [[{id: 'Rx', arg: '3pi/4'}]]});
    });
});

test('opens the enlarged Bloch sphere view from a Bloch display gate', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Bloch']]}, async page => {
        const canvasBounds = await page.$eval('#drawCanvas', element => {
            const bounds = element.getBoundingClientRect();
            return {x: bounds.x, y: bounds.y};
        });

        // The Bloch display gate sits in the second column on the first wire. Retried for the
        // same layout-shift race the parameter dialog test guards against.
        let opened = false;
        for (let attempt = 0; attempt < 3 && !opened; attempt++) {
            await waitForCanvasViewport(page);
            const circuitTop = await circuitTopForWires(page, 2);
            await page.mouse.click(canvasBounds.x + circuitMetrics.columnSpacing + circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2, canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2);
            opened = await page.waitForSelector('[data-panel-id="bloch"]', {visible: true, timeout: 2000}).
                then(() => true, () => false);
        }
        assert.ok(opened, 'The Bloch sphere panel must open.');
        await page.waitForFunction(
            () => document.getElementById('bloch-subtitle').textContent !== '',
            {timeout: TEST_TIMEOUT_MILLIS});

        // After the Hadamard the qubit is |+⟩: on the +x axis, pure, at θ 90°.
        const readout = await page.evaluate(() => ({
            subtitle: document.getElementById('bloch-subtitle').textContent,
            x: document.getElementById('bloch-x').textContent,
            z: document.getElementById('bloch-z').textContent,
            theta: document.getElementById('bloch-theta').textContent,
            purity: document.getElementById('bloch-purity').textContent,
        }));
        assert.equal(readout.subtitle, 'Qubit 1 · at column 2');
        assert.equal(readout.x, '+1.000');
        assert.equal(readout.z, '+0.000');
        assert.equal(readout.theta, '90.0°');
        assert.equal(readout.purity, '1.000');

        await closePanel(page, 'bloch');
    });
});
