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

import assert from 'node:assert/strict';
import {test, withQuirkPage, waitForCircuit, TEST_TIMEOUT_MILLIS, canvasLayout, assertCircuitLayout, waitForCanvasViewport, circuitMetrics, circuitTopForWires} from './harness.js';

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

        // The group headings name a group, they never hide one: no fold control, and no tile
        // list left hidden by a fold remembered from an earlier session.
        const headings = await page.evaluate(() => ({
            controls: document.querySelectorAll('.gate-group-label button').length,
            hiddenLists: [...document.querySelectorAll('.gate-group-tiles')].
                filter(list => list.hidden || getComputedStyle(list).display === 'none').length
        }));
        assert.deepEqual(headings, {controls: 0, hiddenLists: 0});

        await page.click('#gate-search');
        await page.keyboard.type('qft');
        await page.waitForFunction(
            () => [...document.querySelectorAll('.gate-tile')].filter(tile => !tile.hidden).length === 2,
            {timeout: TEST_TIMEOUT_MILLIS});
        const filtered = await shown();
        assert.deepEqual(filtered.tiles, ['Fourier Transform Gate', 'Inverse Fourier Transform Gate']);
        assert.deepEqual(filtered.groups, ['Frequency']);

        // The hidden attribute must actually unrender the tile: an author display rule outranks
        // the browser's [hidden] styling, which once left non-matching tiles painted inside a
        // partially-matching group.
        const paintedButHidden = await page.evaluate(() =>
            [...document.querySelectorAll('.gate-tile')].filter(tile =>
                tile.hidden && getComputedStyle(tile).display !== 'none').length);
        assert.equal(paintedButHidden, 0, 'Attribute-hidden tiles must not stay painted.');

        // A search that matches nothing says so rather than showing an empty sidebar.
        await page.keyboard.type('zzzz');
        await page.waitForFunction(
            () => !document.getElementById('gate-toolbox-empty').hidden,
            {timeout: TEST_TIMEOUT_MILLIS});

        await page.keyboard.press('Escape');
        await page.waitForFunction(
            () => [...document.querySelectorAll('.gate-tile')].filter(tile => !tile.hidden).length > 90,
            {timeout: TEST_TIMEOUT_MILLIS});

        // Hovering a tile brings up the gate's own documentation: its matrix written out, what it
        // does to each basis state, and the turn it performs.
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
        await page.waitForSelector('.gate-hover', {visible: true, timeout: TEST_TIMEOUT_MILLIS});
        const card = await page.$eval('.gate-hover', element => ({
            title: element.querySelector('.gate-details-title').textContent,
            cells: element.querySelectorAll('math mtd').length,
            // Real typesetting, not glyphs: a stacked fraction over a radical.
            fractions: element.querySelectorAll('math mfrac').length,
            roots: element.querySelectorAll('math msqrt').length,
            mathHeight: Math.round(element.querySelector('math').getBoundingClientRect().height),
            actions: [...element.querySelectorAll('.gate-details-actions li')].map(e => e.textContent),
            axis: element.querySelector('.gate-details-facts dd')?.textContent,
            hasFigure: element.querySelector('.rotation-figure') !== null
        }));
        assert.equal(card.title, 'Hadamard Gate');
        assert.equal(card.cells, 4, 'The matrix must be written out, one element per entry.');
        assert.equal(card.fractions, 4);
        assert.equal(card.roots, 4);
        // A stacked fraction is taller than a line of text; a glyph fallback would not be.
        assert.ok(card.mathHeight > 40, `The matrix must be typeset, saw ${card.mathHeight}px.`);
        assert.deepEqual(card.actions, [
            'transforms |0⟩ into √½|0⟩ + √½|1⟩',
            'transforms |1⟩ into √½|0⟩ - √½|1⟩'
        ]);
        assert.ok(card.hasFigure, 'A one-qubit gate must show the turn it performs.');
        assert.ok(card.axis.startsWith('180°'), `The turn must be named, saw ${card.axis}.`);
    });
});

test('documents a gate too tall to write out by drawing its matrix tile by tile', async browser => {
    // A custom gate built from a six-qubit circuit: its 64 x 64 matrix is never built whole.
    const TALL = {cols: [['~tall']], gates: [{id: '~tall', name: 'Tall', circuit: {cols: [['inc6'], ['H']]}}]};
    await withQuirkPage(browser, TALL, async page => {
        const tile = await page.evaluate(() => {
            const target = [...document.querySelectorAll('.gate-tile')].
                find(e => e.getAttribute('aria-label') === 'Tall Gate [tall]');
            target.scrollIntoView({block: 'center'});
            const bounds = target.getBoundingClientRect();
            return {x: bounds.x + bounds.width/2, y: bounds.y + bounds.height/2};
        });
        await page.mouse.move(tile.x, tile.y);
        await page.waitForSelector('.gate-hover', {visible: true, timeout: TEST_TIMEOUT_MILLIS});
        const card = await page.waitForFunction(() => {
            const view = document.querySelector('.gate-hover .operator-view-canvas');
            return view?.dataset.painted !== 'true' ? false : {
                title: document.querySelector('.gate-hover .gate-details-title').textContent,
                label: view.getAttribute('aria-label'),
                note: document.querySelector('.gate-hover .gate-details-note')?.textContent ?? null,
            };
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());
        assert.equal(card.title, 'Tall Gate [tall]');
        assert.match(card.label, /64 by 64$/);
        assert.equal(card.note, null, 'A tall gate must be drawn, not dismissed with a note.');
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

test('keeps the gate palette in the dock beside the circuit, where it cannot be closed', async browser => {
    const circuit = {cols: [['H'], ['Bloch']]};
    await withQuirkPage(browser, circuit, async page => {
        const wideLayout = await canvasLayout(page);
        assertCircuitLayout(wideLayout);

        // The canvas is a fixed viewport: it fills its scroll cell exactly, and the circuit
        // centers inside it.
        await waitForCanvasViewport(page);
        // The redraw loop resizes the canvas from a ResizeObserver a frame or two after layout
        // settles, so wait for the match rather than sampling it once.
        const viewportMatch = await page.waitForFunction(() => {
            const cell = document.getElementById('canvasDiv');
            const canvas = document.querySelector('#drawCanvas canvas');
            return canvas.width === cell.clientWidth && canvas.height === cell.clientHeight;
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(() => true, () => false);
        assert.ok(viewportMatch, 'The canvas must fill its scroll cell exactly.');

        // The palette is a dock panel of its own, in its own group to the circuit's left. Like the
        // circuit it is permanent, so neither tab offers to close. Permanent panels render in
        // dockview's overlay rather than inside their group, so groups are found through the tabs.
        const dock = await page.evaluate(() => {
            const tab = title => [...document.querySelectorAll('.dv-tab')].find(t => t.textContent.trim() === title);
            const bounds = name => document.querySelector(`[data-panel-id="${name}"]`).getBoundingClientRect();
            const tabs = [...document.querySelectorAll('.dv-tab')].map(t => ({
                title: t.textContent.trim(),
                closable: t.querySelector('.dv-default-tab-action') !== null,
            }));
            return {
                separate: tab('Gates').closest('.dv-groupview') !== tab('Circuit').closest('.dv-groupview'),
                paletteLeft: bounds('gates').right <= bounds('circuit').left + 1,
                paletteWidth: Math.round(bounds('gates').width),
                tabs,
            };
        });
        assert.ok(dock.separate && dock.paletteLeft, 'The palette must start beside the circuit, on its left.');
        assert.ok(dock.paletteWidth >= 200 && dock.paletteWidth <= 280,
            `The palette must start at its own width, not half the dock; saw ${dock.paletteWidth}px.`);
        assert.deepEqual(dock.tabs.filter(tab => tab.closable), [], 'Permanent panels must not offer to close.');
        assert.deepEqual(dock.tabs.map(tab => tab.title).sort(), ['Circuit', 'Gates']);
    });
});

test('on a narrow screen the gate palette is a tab that gives way to the circuit when a gate is taken', async browser => {
    await withQuirkPage(browser, {cols: []}, async page => {
        // Below 920px a column of gates would squeeze the circuit, so the palette starts as a tab
        // behind it and the circuit keeps the whole width.
        const start = await page.evaluate(() => {
            const tab = title => [...document.querySelectorAll('.dv-tab')].find(t => t.textContent.trim() === title);
            return {
                sameGroup: tab('Gates').closest('.dv-groupview') === tab('Circuit').closest('.dv-groupview'),
                circuitWidth: document.getElementById('canvasDiv').getBoundingClientRect().width,
            };
        });
        assert.ok(start.sameGroup, 'On a narrow screen the palette must share the circuit\'s group.');
        assert.ok(start.circuitWidth > 690, `The circuit must keep the width, saw ${start.circuitWidth}px.`);

        await waitForCanvasViewport(page);
        const canvasBounds = await page.$eval('#drawCanvas canvas', element => {
            const bounds = element.getBoundingClientRect();
            return {x: bounds.x, y: bounds.y};
        });
        const circuitTop = await circuitTopForWires(page, 2);

        const target = {
            x: canvasBounds.x + circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2,
            y: canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2,
        };

        // Showing the palette's tab covers the circuit with it...
        const gatesTab = await page.evaluate(() => {
            const tab = [...document.querySelectorAll('.dv-tab')].find(t => t.textContent.trim() === 'Gates');
            const bounds = tab.getBoundingClientRect();
            return {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2};
        });
        await page.mouse.click(gatesTab.x, gatesTab.y);
        // Both panels render "always", so a covered one keeps its layout: what counts is which is on
        // top, so the tile has to be the element under its own centre.
        const tile = await page.waitForFunction(() => {
            const target = [...document.querySelectorAll('.gate-tile')].
                find(e => e.getAttribute('aria-label') === 'Hadamard Gate');
            target.scrollIntoView({block: 'center'});
            const bounds = target.getBoundingClientRect();
            const centre = {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2};
            return document.elementFromPoint(centre.x, centre.y)?.closest('.gate-tile') === target ? centre : false;
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());

        // ...and taking a gate brings the circuit back on top, so the drag can land on it.
        await page.mouse.move(tile.x, tile.y);
        await page.mouse.down();
        await page.waitForFunction(
            ({x, y}) => document.elementFromPoint(x, y)?.closest('#circuit-area') !== null,
            {timeout: TEST_TIMEOUT_MILLIS}, target);
        await page.mouse.move(target.x, target.y, {steps: 8});
        await page.mouse.up();
        await waitForCircuit(page, {cols: [['H']]});
    }, {width: 700, height: 480, deviceScaleFactor: 1});
});
