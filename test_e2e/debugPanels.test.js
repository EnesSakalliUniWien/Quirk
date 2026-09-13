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

// The playhead's debug panels: each opens from the toolbar into the dock, and each reports the
// state the playhead has reached rather than the whole circuit's.

import assert from 'node:assert/strict';
import {test, withQuirkPage, waitForPanel, TEST_TIMEOUT_MILLIS} from './harness.js';

const BELL = {cols: [['H'], ['•', 'X']]};

async function runToEnd(page) {
    await page.click('#playhead-end-button');
    await page.waitForFunction(
        () => document.getElementById('playhead-position').textContent.trim() === 'gate 2 / 2',
        {timeout: TEST_TIMEOUT_MILLIS});
}

test('the algebra panel lists every operation with its matrix and the change it makes', async browser => {
    await withQuirkPage(browser, BELL, async page => {
        await page.click('#algebra-button');
        await waitForPanel(page, 'algebra', true);
        const panel = await page.waitForFunction(() => {
            const root = document.querySelector('[data-panel-id="algebra"]');
            const steps = root?.querySelectorAll('.algebra-step');
            // The chart paints on the shared renderer after the list renders, so wait for both.
            const chart = root?.querySelector('.algebra-evolution canvas');
            const drawn = chart?.dataset.painted === 'true';
            return steps === undefined || steps.length !== 3 || !drawn ? false : {
                summary: root.querySelector('.debug-panel-summary').textContent,
                descriptions: [...root.querySelectorAll('.algebra-step-description')].map(e => e.textContent),
                // Start shows one state; each step expands operator, input and output.
                tablesPerStep: [...steps].map(step => step.querySelectorAll('mtable').length),
                cnotRows: steps[2].querySelector('mtable').querySelectorAll('mtr').length,
                changedAfterCnot: steps[2].querySelectorAll('mtd[data-changed]').length,
                // Three states, one column each, over four basis states: a square cell apiece.
                evolutionShape: chart.width / chart.height,
            };
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());
        assert.match(panel.summary, /2 steps · 2 qubits · every matrix reproduces the simulated state/);
        assert.equal(panel.descriptions[0], 'Start');
        assert.deepEqual(panel.tablesPerStep, [1, 3, 3]);
        assert.equal(panel.cnotRows, 4, 'CNOT over two qubits is 4x4.');
        // CNOT moves the |01> amplitude to |11>: exactly those two entries change.
        assert.equal(panel.changedAfterCnot, 2);
        assert.ok(Math.abs(panel.evolutionShape - 3 / 4) < 0.01, 'The chart has a column per step and a row per basis state.');

        // Choosing a step moves the playhead there, and the list marks it.
        await page.evaluate(() => document.querySelectorAll('[data-panel-id="algebra"] .algebra-step-header')[1].click());
        await page.waitForFunction(
            () => document.getElementById('playhead-position').textContent.trim() === 'gate 1 / 2' &&
                document.querySelectorAll('[data-panel-id="algebra"] .algebra-step')[1].getAttribute('aria-current') === 'step',
            {timeout: TEST_TIMEOUT_MILLIS});
    });
});

test('the algebra steps run left to right, follow the playhead and scroll sideways', async browser => {
    // Eight steps of two-qubit matrices: far wider than the panel.
    const LONG = {cols: [['H'], ['X'], ['H'], ['X'], ['H'], ['X'], ['H'], ['X']]};
    await withQuirkPage(browser, LONG, async page => {
        await page.click('#algebra-button');
        await waitForPanel(page, 'algebra', true);
        await page.waitForFunction(
            () => document.querySelectorAll('[data-panel-id="algebra"] .algebra-step').length === 9,
            {timeout: TEST_TIMEOUT_MILLIS});

        const layout = await page.evaluate(() => {
            const track = document.querySelector('[data-panel-id="algebra"] .algebra-steps');
            const [first, second] = track.querySelectorAll('.algebra-step');
            const a = first.getBoundingClientRect(), b = second.getBoundingClientRect();
            return {sideBySide: b.left >= a.right - 1 && Math.abs(b.top - a.top) < 1,
                    overflows: track.scrollWidth > track.clientWidth, scrollLeft: track.scrollLeft};
        });
        assert.ok(layout.sideBySide, 'Steps must run left to right, not down the panel.');
        assert.ok(layout.overflows, 'Eight steps must be wider than the panel, so it scrolls.');
        assert.equal(layout.scrollLeft, 0, 'The playhead starts at the first step.');

        // A horizontal gesture over the steps scrolls them sideways.
        const box = await page.$eval('[data-panel-id="algebra"] .algebra-steps', el => {
            const r = el.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + 40};
        });
        await page.mouse.move(box.x, box.y);
        await page.mouse.wheel({deltaX: 400});
        await page.waitForFunction(
            () => document.querySelector('[data-panel-id="algebra"] .algebra-steps').scrollLeft > 0,
            {timeout: TEST_TIMEOUT_MILLIS});

        // Stepping moves the view with it: the last step ends up in sight.
        await page.click('#playhead-end-button');
        await page.waitForFunction(() => {
            const track = document.querySelector('[data-panel-id="algebra"] .algebra-steps');
            const card = track.querySelector('[data-step="8"]');
            const t = track.getBoundingClientRect(), c = card.getBoundingClientRect();
            return card.getAttribute('aria-current') === 'step' && c.left >= t.left - 1 &&
                (c.width > t.width ? c.left <= t.left + 1 : c.right <= t.right + 1);
        }, {timeout: TEST_TIMEOUT_MILLIS});
    });
});

test('rotation entries are written as cosines and sines of their angle', async browser => {
    await withQuirkPage(browser, {cols: [[{id: 'Rx', arg: 'pi/4'}]]}, async page => {
        await page.click('#algebra-button');
        await waitForPanel(page, 'algebra', true);
        const functions = await page.waitForFunction(() => {
            const step = document.querySelectorAll('[data-panel-id="algebra"] .algebra-step')[1];
            const names = step === undefined ? [] : [...step.querySelectorAll('mtable')[0].querySelectorAll('mi')].map(e => e.textContent);
            return names.includes('cos') ? names : false;
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());
        // Rx(π/4) is cos(π/8) on the diagonal and -i sin(π/8) off it.
        assert.ok(functions.includes('cos'));
        assert.ok(functions.includes('sin'));
    });
});

test('every step of a large register is drawn as an operator that zooms to its entries', async browser => {
    // Twelve qubits: 4096 x 4096 operators, far too many entries to write out or to draw as discs.
    const WIDE = {cols: [['H'], ['•', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 'X'], ['inc12']]};
    await withQuirkPage(browser, WIDE, async page => {
        await page.click('#algebra-button');
        await waitForPanel(page, 'algebra', true);
        const drawn = await page.waitForFunction(() => {
            const root = document.querySelector('[data-panel-id="algebra"]');
            const views = [...(root?.querySelectorAll('.operator-view-canvas') ?? [])];
            const chart = root?.querySelector('.algebra-evolution canvas');
            return views.length !== 3 || views.some(v => v.dataset.painted !== 'true') || chart?.dataset.painted !== 'true' ? false : {
                summary: root.querySelector('.debug-panel-summary').textContent,
                chartDetail: chart.dataset.detail,
                notes: [...root.querySelectorAll('.debug-panel-note')].map(e => e.textContent),
            };
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());
        assert.match(drawn.summary, /3 steps · 12 qubits · every matrix reproduces the simulated state/);
        assert.equal(drawn.chartDetail, 'pixels', 'Past a few pixels per entry the chart is drawn as pixels.');
        assert.deepEqual(drawn.notes, [], 'No step may stop at a size limit.');

        // Zooming in twice asks for finer tiles, and draws them.
        const card = '[data-panel-id="algebra"] [data-step="3"]';
        await page.click(`${card} button[aria-label="Zoom in"]`);
        await page.click(`${card} button[aria-label="Zoom in"]`);
        await page.waitForFunction(card => {
            const view = document.querySelector(`${card} .operator-view-canvas`);
            return document.querySelector(`${card} .operator-view-zoom`).textContent === '×4' &&
                view.dataset.level === '2' && view.dataset.painted === 'true';
        }, {timeout: TEST_TIMEOUT_MILLIS}, card);

        // Hovering reads an entry's exact value off the step's structure.
        const box = await page.$eval(`${card} .operator-view-canvas`, el => {
            const r = el.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2};
        });
        await page.mouse.move(box.x, box.y);
        const readout = await page.waitForFunction(card => {
            const text = document.querySelector(`${card} .operator-view-readout`).textContent;
            return text.includes('|U|') ? text : false;
        }, {timeout: TEST_TIMEOUT_MILLIS}, card).then(handle => handle.jsonValue());
        assert.match(readout, /⟨[01]{12}\|U\|[01]{12}⟩ = /);
    });
});

test('the probabilities panel charts each possible outcome', async browser => {
    await withQuirkPage(browser, BELL, async page => {
        await runToEnd(page);
        await page.click('#probabilities-button');
        await waitForPanel(page, 'probabilities', true);
        const chart = await page.waitForFunction(() => {
            const root = document.querySelector('[data-panel-id="probabilities"]');
            const chart = root?.querySelector('.probabilities-chart');
            return chart?.dataset.painted !== 'true' ? false : {
                label: root.querySelector('.probabilities-chart').getAttribute('aria-label'),
                summary: root.querySelector('.debug-panel-summary').textContent,
            };
        }, {timeout: TEST_TIMEOUT_MILLIS}).then(handle => handle.jsonValue());
        // A Bell pair only ever reads 00 or 11, half the time each.
        assert.equal(chart.summary, '2 of 4 outcomes possible');
        assert.match(chart.label, /\|00⟩ 50\.0%/);
        assert.match(chart.label, /\|11⟩ 50\.0%/);
    });
});

test('the qubits panel shows which qubits the circuit has entangled', async browser => {
    await withQuirkPage(browser, BELL, async page => {
        await page.click('#qubits-button');
        await waitForPanel(page, 'qubits', true);
        const readPurities = () => page.evaluate(() =>
            [...document.querySelectorAll('[data-panel-id="qubits"] .qubits-purity')].
                map(cell => cell.textContent));
        // Before anything runs both qubits are |0>, each in a state of its own.
        await page.waitForFunction(
            () => document.querySelectorAll('[data-panel-id="qubits"] .qubits-purity').length === 2,
            {timeout: TEST_TIMEOUT_MILLIS});
        assert.deepEqual(await readPurities(), ['1.000', '1.000']);

        await runToEnd(page);
        await page.waitForFunction(
            () => [...document.querySelectorAll('[data-panel-id="qubits"] .qubits-mixed')].length === 2,
            {timeout: TEST_TIMEOUT_MILLIS});
        assert.deepEqual(await readPurities(), ['0.500', '0.500']);
    });
});
