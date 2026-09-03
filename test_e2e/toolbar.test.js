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

// The app toolbar: the shadcn buttons and the WAI-ARIA toolbar pattern.

import assert from 'node:assert/strict';
import {test, withQuirkPage, waitForQuirk, waitForCircuit, waitForDialog, currentCircuit, exportedCircuit, urlForCircuit, TEST_TIMEOUT_MILLIS} from './harness.js';

test('renders the circuit controls with shadcn buttons', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        const toolbar = await page.$eval('#app-toolbar-root [role="toolbar"]', element => ({
            label: element.getAttribute('aria-label'),
            brand: element.querySelector('.app-brand-copy strong')?.textContent,
            buttonIds: Array.from(element.querySelectorAll('[data-slot="button"]'), button => button.id),
            buttonGroupCount: element.querySelectorAll('[data-slot="button-group"]').length
        }));

        assert.equal(await page.$eval('html', element => element.classList.contains('dark')), true);
        assert.equal(await page.$eval('html', element => getComputedStyle(element).colorScheme), 'dark');
        assert.equal(
            await page.$eval('#drawCanvas', element => getComputedStyle(element).filter),
            'none');
        assert.equal(toolbar.label, 'Circuit controls');
        assert.equal(toolbar.brand, 'Shadow-Quant');
        // Clear All comes last, away from Clear Circuit, and is no longer joined to it in a group.
        assert.deepEqual(toolbar.buttonIds, [
            'menu-button',
            'export-button',
            'clear-circuit-button',
            'undo-button',
            'redo-button',
            'gate-forge-button',
            'clear-all-button'
        ]);
        assert.equal(toolbar.buttonGroupCount, 2);

        const clearGap = await page.evaluate(() => {
            const a = document.getElementById('clear-circuit-button').getBoundingClientRect();
            const b = document.getElementById('clear-all-button').getBoundingClientRect();
            return Math.round(b.left - a.right);
        });
        assert.ok(clearGap > 100, `Clear All must sit well clear of Clear Circuit, gap was ${clearGap}px.`);

        // The template's unlayered `font: inherit` must not outrank Tailwind's utilities layer,
        // or the shadcn buttons silently lose their text-sm/font-medium type.
        const typography = await page.$$eval(
            '#app-toolbar-root [data-slot="button"]',
            els => els.map(el => {
                const s = getComputedStyle(el);
                return `${s.fontSize}/${s.fontWeight}/${el.getBoundingClientRect().height}`;
            }));
        assert.deepEqual([...new Set(typography)], ['14px/500/32']);

        // WAI-ARIA's toolbar pattern: one tab stop, arrow keys move between the controls.
        const roving = await page.evaluate(() => {
            const items = () => [...document.querySelectorAll('#app-toolbar-root [data-slot="button"]')];
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
            return {stopsOnLoad, order, lastEnabledId: enabled[enabled.length - 1].id,
                    firstEnabledId: enabled[0].id};
        });
        assert.equal(roving.stopsOnLoad, 1, 'The toolbar must be a single tab stop.');
        assert.notEqual(roving.order[0], roving.order[1], 'ArrowRight must move off the first control.');
        assert.equal(roving.order[2], roving.lastEnabledId, 'End must reach the last enabled control.');
        assert.equal(roving.order[3], roving.firstEnabledId, 'Home must return to the first control.');
    });
});
