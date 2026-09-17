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

// Registers: named groups of wires, from the circuit JSON, the gutter and the panels; and the
// prepare boxes that start their wires in a state.

import assert from 'node:assert/strict';
import {Layout} from '../src/config/Layout.js';
import {
    test, withQuirkPage, waitForCircuit, waitForPanel, waitForCanvasViewport, circuitMetrics, circuitTopForWires,
    TEST_TIMEOUT_MILLIS,
} from './harness.js';

// a starts at 5 and an increment makes it 6; b starts as a Bell pair, with its values 0 and 3
// labelled.
const NAMED = {
    cols: [[{id: 'Prep3', arg: 5}, 1, 1, 'PrepBell'], ['inc3']],
    registers: [{name: 'a', wires: [0, 3]}, {name: 'b', wires: [3, 2], labels: {0: 'A', 3: 'D'}}],
};

async function runToEnd(page, operations) {
    await page.click('#playhead-end-button');
    await page.waitForFunction(
        text => document.getElementById('playhead-position').textContent.trim() === text,
        {timeout: TEST_TIMEOUT_MILLIS}, `operation ${operations} / ${operations}`);
}

/** Where a wire's label is on screen. Registers add a name column left of the labels. */
async function wireLabelAt(page, wire, wireCount, named) {
    const canvas = await page.$eval('#drawCanvas canvas', element => {
        const bounds = element.getBoundingClientRect();
        return {x: bounds.x, y: bounds.y};
    });
    const top = await circuitTopForWires(page, wireCount);
    return {
        x: canvas.x + (named ? Layout.REGISTER_NAME_WIDTH : 0) + Layout.REGISTER_MARGIN + Layout.REGISTER_INDEX_WIDTH / 2,
        y: canvas.y + top + circuitMetrics.wireSpacing * (wire + 0.5),
    };
}

test('prepare boxes start the registers, and every panel reads by register', async browser => {
    await withQuirkPage(browser, NAMED, async page => {
        await runToEnd(page, 2);

        await page.click('#state-button');
        await waitForPanel(page, 'state', true);
        const table = await page.waitForFunction(() => {
            const rows = [...document.querySelectorAll('#state-table-body tr')];
            return rows.length !== 2 ? false : {
                header: [...document.querySelectorAll('#state-table thead th')].map(th => th.textContent),
                rows: rows.map(tr => [...tr.children].slice(0, 5).map(td => td.textContent.trim())),
            };
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());
        // The registers read together as a sequence; the bits column says which wire each bit is,
        // highest first, grouped by register.
        assert.deepEqual(table.header.slice(0, 4), ['a', 'b', 'sequence', 'b₁b₀·a₂a₁a₀']);
        // b's labelled values read by their labels; the bits stay bits.
        assert.deepEqual(table.rows, [
            ['6', 'A', '6·A', '|00·110⟩', '0.5000'],
            ['6', 'D', '6·D', '|11·110⟩', '0.5000'],
        ]);

        await page.click('#probabilities-button');
        await waitForPanel(page, 'probabilities', true);
        // Each outcome's row, named in the registers' words, with its chance after the last step.
        const finals = await page.waitForFunction(() => {
            const rows = [...document.querySelectorAll('[data-panel-id="probabilities"] .probabilities-trace tbody tr')];
            return rows.length === 0 ? false : rows.map(row =>
                [row.querySelector('th').textContent, [...row.querySelectorAll('.probabilities-value')].at(-1).textContent]);
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());
        assert.deepEqual(finals.filter(([, chance]) => chance !== '0'), [['|a=6, b=A⟩', '50.0'], ['|a=6, b=D⟩', '50.0']]);

        await page.click('#qubits-button');
        await waitForPanel(page, 'qubits', true);
        const firstQubit = await page.waitForFunction(
            () => document.querySelector('[data-panel-id="qubits"] .qubits-name')?.textContent,
            {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());
        assert.equal(firstQubit, 'a₀');

        // The Registers panel labels a value in place, and the label lands in the circuit.
        await page.click('#registers-button');
        await waitForPanel(page, 'registers', true);
        await page.waitForSelector('[data-register="a"] .registers-label-input', {timeout: TEST_TIMEOUT_MILLIS});
        await page.click('[data-register="a"] input[aria-label="The value of a to label"]', {clickCount: 3});
        await page.keyboard.type('6');
        await page.click('[data-register="a"] .registers-label-input');
        await page.keyboard.type('six');
        await page.keyboard.press('Enter');
        await waitForCircuit(page, {
            cols: NAMED.cols,
            registers: [{name: 'a', wires: [0, 3], labels: {6: 'six'}}, {name: 'b', wires: [3, 2], labels: {0: 'A', 3: 'D'}}],
        });
        // The state table, brought back to the front, reads the value by its label.
        await page.click('#state-button');
        await page.waitForFunction(
            () => document.querySelector('#state-table-body tr td')?.textContent.trim() === 'six',
            {timeout: TEST_TIMEOUT_MILLIS});

        await page.click('#algebra-button');
        await waitForPanel(page, 'algebra', true);
        const descriptions = await page.waitForFunction(() => {
            const found = [...document.querySelectorAll('[data-panel-id="algebra"] .algebra-step-description')];
            return found.length === 3 ? found.map(e => e.textContent) : false;
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());
        assert.equal(descriptions[1], 'Prepare Value on a, Prepare Bell Pair on b');
        assert.match(descriptions[2], / on a$/);
    });
});

test('a drag down the wire labels makes a register and offers its name at once', async browser => {
    await withQuirkPage(browser, {cols: [['X']]}, async page => {
        await waitForCanvasViewport(page);
        const start = await wireLabelAt(page, 0, 2, false);
        const end = await wireLabelAt(page, 1, 2, false);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, {steps: 6});
        await page.mouse.up();
        await waitForCircuit(page, {cols: [['X']], registers: [{name: 'a', wires: [0, 2]}]});

        // The rename box opens over the new name, its text selected: typing replaces it.
        await page.waitForFunction(
            () => document.activeElement?.classList.contains('gutter-rename') && document.activeElement.value === 'a',
            {timeout: TEST_TIMEOUT_MILLIS});
        await page.keyboard.type('acc');
        await page.keyboard.press('Enter');
        await waitForCircuit(page, {cols: [['X']], registers: [{name: 'acc', wires: [0, 2]}]});
        await page.waitForFunction(() => document.querySelector('.gutter-rename') === null, {timeout: TEST_TIMEOUT_MILLIS});

        // A name that is taken is refused where it was typed; Escape gives up. Two quick clicks are
        // a double click: puppeteer's clickCount option arrives as one click here.
        const label = await wireLabelAt(page, 0, 2, true);
        await page.mouse.click(label.x, label.y);
        await page.mouse.click(label.x, label.y);
        await page.waitForSelector('.gutter-rename', {timeout: TEST_TIMEOUT_MILLIS});
        await page.keyboard.type('q0');
        await page.keyboard.press('Enter');
        await page.waitForSelector('.gutter-rename-error', {timeout: TEST_TIMEOUT_MILLIS});
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('.gutter-rename') === null, {timeout: TEST_TIMEOUT_MILLIS});

        await page.click('#undo-button');
        await waitForCircuit(page, {cols: [['X']], registers: [{name: 'a', wires: [0, 2]}]});
    });
});

test('a right click on a wire label groups, feeds and ungroups through its menu', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        await waitForCanvasViewport(page);
        const label = await wireLabelAt(page, 1, 2, false);
        await page.mouse.click(label.x, label.y, {button: 'right'});
        const item = await page.waitForSelector('.app-menu [role="menuitem"]', {timeout: TEST_TIMEOUT_MILLIS});
        assert.equal(await item.evaluate(e => e.textContent), 'Group q1 into a register');
        await item.click();
        await waitForCircuit(page, {cols: [['H']], registers: [{name: 'a', wires: [1, 1]}]});

        // The Registers panel opens on the new register, its name ready to type.
        await waitForPanel(page, 'registers', true);
        await page.waitForFunction(
            () => document.activeElement?.classList.contains('registers-name-input') && document.activeElement.value === 'a',
            {timeout: TEST_TIMEOUT_MILLIS});
        await page.keyboard.type('anc');
        await page.keyboard.press('Enter');
        await waitForCircuit(page, {cols: [['H']], registers: [{name: 'anc', wires: [1, 1]}]});

        // On a register's label the menu feeds an input, and ungroups.
        const named = await wireLabelAt(page, 1, 2, true);
        await page.mouse.click(named.x, named.y, {button: 'right'});
        const feedA = await page.waitForSelector('.app-menu [role="menuitemradio"][data-value="A"]', {timeout: TEST_TIMEOUT_MILLIS}).
            catch(() => undefined);
        if (feedA !== undefined) {
            await feedA.click();
        } else {
            await page.evaluate(() => [...document.querySelectorAll('.app-menu [role="menuitemradio"]')].
                find(e => e.textContent === 'Input A').click());
        }
        await waitForCircuit(page, {cols: [['H']], registers: [{name: 'anc', wires: [1, 1], input: 'A'}]});

        await page.mouse.click(named.x, named.y, {button: 'right'});
        await page.waitForSelector('.app-menu', {timeout: TEST_TIMEOUT_MILLIS});
        await page.evaluate(() => [...document.querySelectorAll('.app-menu [role="menuitem"]')].
            find(e => e.textContent.startsWith('Ungroup')).click());
        await waitForCircuit(page, {cols: [['H']]});
    });
});

test('the palette offers prepare boxes, and one after a gate on its wires is disabled', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Prep1']]}, async page => {
        const group = await page.evaluate(() => {
            const label = [...document.querySelectorAll('.gate-group-label')].find(e => e.textContent === 'Prepare');
            const tiles = label === undefined ? [] : [...label.parentElement.querySelectorAll('.gate-tile')];
            return tiles.map(tile => tile.getAttribute('aria-label'));
        });
        assert.deepEqual(group, [
            'Prepare Value', 'Prepare Uniform', 'Prepare Bell Pair', 'Prepare GHZ', 'Prepare W', 'Prepare State']);

        // Disabled, so the run ignores it: H alone leaves |0⟩ and |1⟩ equally likely on the first of
        // the circuit's two wires. A box that ran would post-select and leave one outcome.
        await runToEnd(page, 1);
        await page.click('#probabilities-button');
        await waitForPanel(page, 'probabilities', true);
        const summary = await page.waitForFunction(() => {
            const root = document.querySelector('[data-panel-id="probabilities"]');
            return root?.querySelector('.probabilities-trace') !== null && root?.querySelector('.probabilities-trace') !== undefined &&
                root.querySelector('.debug-panel-summary').textContent;
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());
        assert.equal(summary, '2 of 4 outcomes possible · largest 50.0%');
    });
});
