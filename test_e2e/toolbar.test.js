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

// The app toolbar: the button row and the WAI-ARIA toolbar pattern.

import assert from 'node:assert/strict';
import {EXAMPLE_CIRCUITS} from '../src/config/exampleCircuits.js';
import {test, withQuirkPage, currentCircuit, waitForCircuit, TEST_TIMEOUT_MILLIS} from './harness.js';

test('renders the circuit controls as a button toolbar', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        const toolbar = await page.$eval('.app-toolbar[role="toolbar"]', element => ({
            label: element.getAttribute('aria-label'),
            buttonIds: Array.from(element.querySelectorAll('[data-slot="button"]'), button => button.id),
            buttonGroupCount: element.querySelectorAll('[data-slot="button-group"]').length
        }));

        assert.equal(await page.$eval('html', element => element.classList.contains('dark')), true);
        assert.equal(await page.$eval('html', element => getComputedStyle(element).colorScheme), 'dark');
        assert.equal(
            await page.$eval('#drawCanvas canvas', element => getComputedStyle(element).filter),
            'none');
        assert.equal(toolbar.label, 'Circuit controls');
        // The brand lives in the sidebar; the toolbar is circuit actions only.
        const sidebarBrand = await page.$eval('.gate-toolbox .app-brand-copy strong',
            element => element.textContent);
        assert.equal(sidebarBrand, 'Shadow-Quant');
        // Clear All comes last, away from Clear Circuit; the row has no button groups.
        assert.deepEqual(toolbar.buttonIds, [
            'examples-button',
            'export-button', 'tape-button',
            'state-button',
            'algebra-button',
            'probabilities-button',
            'qubits-button',
            'registers-button',
            'clear-circuit-button',
            'undo-button',
            'redo-button',
            'gate-forge-button',
            'clear-all-button'
        ]);
        assert.equal(toolbar.buttonGroupCount, 0);
        const labels = await page.$$eval('.app-toolbar [data-slot="button"]',
            els => els.map(el => el.getAttribute('aria-label')));
        assert.deepEqual(labels,
            ['Examples', 'Export', 'Tape', 'State', 'Algebra', 'Probabilities', 'Qubits', 'Registers',
             'Clear Circuit', 'Undo', 'Redo', 'Make Gate', 'Clear All']);

        // The destructive action takes the row's slack: never flush against Clear Circuit, and
        // visibly apart from its neighbour.
        const clearGap = await page.evaluate(() => {
            const clearCircuit = document.getElementById('clear-circuit-button').getBoundingClientRect();
            const makeGate = document.getElementById('gate-forge-button').getBoundingClientRect();
            const clearAll = document.getElementById('clear-all-button').getBoundingClientRect();
            return {
                fromClearCircuit: Math.round(clearAll.left - clearCircuit.right),
                fromNeighbour: Math.round(clearAll.left - makeGate.right),
            };
        });
        assert.ok(clearGap.fromClearCircuit >= 100,
            `Clear All must sit well clear of Clear Circuit, gap was ${clearGap.fromClearCircuit}px.`);
        assert.ok(clearGap.fromNeighbour >= 12,
            `Clear All must sit apart from its neighbour, gap was ${clearGap.fromNeighbour}px.`);

        // The base layer's `font: inherit` reset must not outrank the components layer, or the
        // buttons silently lose their 14px/500 type.
        const typography = await page.$$eval(
            '.app-toolbar [data-slot="button"]',
            els => els.map(el => {
                const s = getComputedStyle(el);
                return `${s.fontSize}/${s.fontWeight}/${el.getBoundingClientRect().height}`;
            }));
        assert.deepEqual([...new Set(typography)], ['14px/500/32']);

        // WAI-ARIA's toolbar pattern: one tab stop, arrow keys move between the controls.
        const roving = await page.evaluate(() => {
            const items = () => [...document.querySelectorAll('.app-toolbar [data-slot="button"]')];
            const enabled = items().filter(b => !b.disabled);
            const press = key => document.activeElement.dispatchEvent(
                new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}));
            const stopsOnLoad = items().filter(b => b.tabIndex === 0).length;
            enabled[0].focus();
            const order = [document.activeElement.id];
            press('ArrowRight');
            order.push(document.activeElement.id);
            press('End');
            order.push(document.activeElement.id);
            press('Home');
            order.push(document.activeElement.id);
            return {stopsOnLoad, order, lastEnabledId: enabled.at(-1).id,
                    firstEnabledId: enabled[0].id};
        });
        assert.equal(roving.stopsOnLoad, 1, 'The toolbar must be a single tab stop.');
        assert.notEqual(roving.order[0], roving.order[1], 'ArrowRight must move off the first control.');
        assert.equal(roving.order[2], roving.lastEnabledId, 'End must reach the last enabled control.');
        assert.equal(roving.order[3], roving.firstEnabledId, 'Home must return to the first control.');
    });
});

test('the examples menu loads a circuit, and undo puts the old one back', async browser => {
    const circuit = {cols: [['H']]};
    await withQuirkPage(browser, circuit, async page => {
        await page.click('#examples-button');
        const item = await page.waitForSelector('.app-menu [role="menuitem"]',
            {timeout: TEST_TIMEOUT_MILLIS});
        assert.equal(await item.evaluate(element => element.textContent), EXAMPLE_CIRCUITS[0].name);

        await item.click();
        await page.waitForFunction(
            startJson => {
                const params = new URLSearchParams(document.location.hash.slice(1).replace(/\+/g, '%2B'));
                return (params.get('circuit') ?? '') !== startJson;
            },
            {timeout: TEST_TIMEOUT_MILLIS},
            JSON.stringify(circuit));
        const loaded = await currentCircuit(page);
        assert.ok(loaded.cols.length > circuit.cols.length,
            `Choosing an example must load its circuit; the URL carried ${JSON.stringify(loaded)}.`);

        // An example is committed like any other edit, so the circuit that was there comes back.
        await page.click('#undo-button');
        await waitForCircuit(page, circuit);
    });
});
