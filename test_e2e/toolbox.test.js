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

// The gate toolbox: search, tooltips, and the responsive reflow.

const assert = require('node:assert/strict');
const {test, withQuirkPage, waitForQuirk, waitForCircuit, waitForDialog, currentCircuit, exportedCircuit, urlForCircuit, TEST_TIMEOUT_MILLIS, canvasLayout, assertCircuitLayout, waitForCanvasViewport} = require('./harness.js');

test('searches the gate toolbox and documents a gate on hover', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        const shown = () => page.evaluate(() => ({
            tiles: [...document.querySelectorAll('.gate-tile')].
                filter(tile => !tile.hidden).
                map(tile => tile.getAttribute('aria-label')),
            groups: [...document.querySelectorAll('.gate-group')].
                filter(section => !section.hidden).
                map(section => section.querySelector('.gate-group-label').textContent),
            emptyShown: !document.getElementById('gate-toolbox-empty').hidden
        }));

        // Every gate is reachable, and each tile carries a readable name rather than only a glyph.
        const all = await shown();
        assert.ok(all.tiles.length > 90, `The toolbox must hold every gate, saw ${all.tiles.length}.`);
        assert.ok(all.tiles.includes('Hadamard Gate'));
        assert.equal(all.emptyShown, false);

        await page.click('#gate-search');
        await page.keyboard.type('qft');
        await page.waitForFunction(
            () => [...document.querySelectorAll('.gate-tile')].filter(tile => !tile.hidden).length === 2,
            {timeout: TEST_TIMEOUT_MILLIS});
        const filtered = await shown();
        assert.deepEqual(filtered.tiles, ['Fourier Transform Gate', 'Inverse Fourier Transform Gate']);
        assert.deepEqual(filtered.groups, ['Frequency']);

        // A search that matches nothing says so rather than showing an empty sidebar.
        await page.keyboard.type('zzzz');
        await page.waitForFunction(
            () => !document.getElementById('gate-toolbox-empty').hidden,
            {timeout: TEST_TIMEOUT_MILLIS});

        await page.keyboard.press('Escape');
        await page.waitForFunction(
            () => [...document.querySelectorAll('.gate-tile')].filter(tile => !tile.hidden).length > 90,
            {timeout: TEST_TIMEOUT_MILLIS});

        // Hovering a tile still brings up the gate's matrix and blurb, painted into a popover.
        const tile = await page.evaluate(() => {
            const target = [...document.querySelectorAll('.gate-tile')].
                find(e => e.getAttribute('aria-label') === 'Hadamard Gate');
            // The gate list scrolls inside the sidebar, so the tile has to be brought into view
            // before its on-screen position means anything.
            target.scrollIntoView({block: 'center'});
            const bounds = target.getBoundingClientRect();
            return {x: bounds.x + bounds.width/2, y: bounds.y + bounds.height/2};
        });
        await page.mouse.move(tile.x, tile.y);
        await page.waitForFunction(
            () => !document.querySelector('.gate-tooltip').hidden,
            {timeout: TEST_TIMEOUT_MILLIS});
        const tooltip = await page.$eval('.gate-tooltip canvas', element => ({
            width: element.width,
            height: element.height
        }));
        assert.ok(tooltip.width > 100 && tooltip.height > 100,
            `The tooltip must be painted, saw ${tooltip.width}x${tooltip.height}.`);
    });
});

test('places gates with the keyboard alone', async browser => {
    await withQuirkPage(browser, {cols: [['X']]}, async page => {
        // The tiles share one tab stop; focusing a tile and pressing Enter appends its gate to
        // the end of the circuit, on the top wire.
        await page.evaluate(() => {
            [...document.querySelectorAll('.gate-tile')].
                find(e => e.getAttribute('aria-label') === 'Hadamard Gate').focus();
        });
        await page.keyboard.press('Enter');
        await waitForCircuit(page, {cols: [['X'], ['H']]});

        // Focus survives the placement, so the arrow keys keep working: down one tile and place
        // that one too.
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await waitForCircuit(page, {cols: [['X'], ['H'], ['Z^½']]});
    });
});

test('keeps the gate toolbox beside the circuit until the viewport is too narrow', async browser => {
    const circuit = {cols: [['H'], ['Bloch']]};
    await withQuirkPage(browser, circuit, async page => {
        const wideLayout = await canvasLayout(page);
        assertCircuitLayout(wideLayout);

        // The canvas is a fixed viewport: it fills its scroll cell exactly, and the circuit
        // centers inside it.
        await waitForCanvasViewport(page);
        const viewportMatch = await page.$eval('#canvasDiv', e => {
            const canvas = document.getElementById('drawCanvas');
            return canvas.width === e.clientWidth && canvas.height === e.clientHeight;
        });
        assert.ok(viewportMatch, 'The canvas must fill its scroll cell exactly.');

        // Below 920px the sidebar leaves the row and becomes an off-canvas drawer, so the
        // circuit keeps the full width instead of being squeezed under a band of gates.
        await page.setViewport({width: 700, height: 480, deviceScaleFactor: 1});
        await page.waitForFunction(
            () => innerWidth === 700 &&
                document.querySelector('.gate-toolbox') === null &&
                document.querySelector('.gate-toolbox-drawer-trigger') !== null,
            {timeout: TEST_TIMEOUT_MILLIS});
        const canvasSpansViewport = await page.$eval(
            '#canvasDiv', element => element.getBoundingClientRect().width > 690);
        assert.ok(canvasSpansViewport, 'The circuit must span the viewport once the sidebar is a drawer.');

        await page.click('.gate-toolbox-drawer-trigger');
        await page.waitForFunction(
            () => document.querySelectorAll('.gate-toolbox .gate-tile').length > 90,
            {timeout: TEST_TIMEOUT_MILLIS});

        await page.keyboard.press('Escape');
        await page.waitForFunction(
            () => document.querySelector('.gate-toolbox') === null,
            {timeout: TEST_TIMEOUT_MILLIS});
    });
});

test('folds toolbox groups shut and remembers the folding across reloads', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        const groupState = () => page.evaluate(() => ({
            expanded: document.querySelector('.gate-group-toggle').getAttribute('aria-expanded'),
            hidden: document.querySelector('.gate-group-tiles').hidden
        }));
        assert.deepEqual(await groupState(), {expanded: 'true', hidden: false});

        await page.click('.gate-group-toggle');
        assert.deepEqual(await groupState(), {expanded: 'false', hidden: true});

        // A search overrides the folding, so matches are always visible.
        await page.click('#gate-search');
        await page.keyboard.type('measure');
        await page.waitForFunction(
            () => !document.querySelector('.gate-group-tiles').hidden,
            {timeout: TEST_TIMEOUT_MILLIS});
        await page.keyboard.press('Escape');
        await page.waitForFunction(
            () => document.querySelector('.gate-group-tiles').hidden,
            {timeout: TEST_TIMEOUT_MILLIS});

        // The folding is remembered per browser.
        await page.reload();
        await waitForQuirk(page);
        assert.deepEqual(await groupState(), {expanded: 'false', hidden: true});
    });
});
