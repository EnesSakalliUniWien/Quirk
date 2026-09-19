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

// The transport bar and the state-at-the-playhead panel.

import assert from 'node:assert/strict';
import {CanvasTheme} from '../src/config/CanvasTheme.js';
import {circuitMetrics, test, withQuirkPage, waitForPanel, TEST_TIMEOUT_MILLIS, waitForCanvasViewport} from './harness.js';

async function playheadBandPixels(page, columnLeft) {
    await waitForCanvasViewport(page);
    return page.evaluate((left, m, background, bandColor) => {
        const canvas = document.querySelector('#drawCanvas canvas');
        const copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d');
        context.drawImage(canvas, 0, 0);
        // The strip between this spec's two wire rows; the circuit band centers vertically, so
        // the sample follows the same layout the app computes.
        const div = document.getElementById('canvasDiv');
        const band = 1.5 * m.wireSpacing + m.gateSize / 2 + m.bottomMargin;
        const top = Math.max(m.topMargin, Math.floor((Math.max(div.clientHeight, band + 2 * m.topMargin) - band) / 2));
        const data = context.getImageData(left - 3, top + m.wireSpacing - 4, 46, 8).data;
        // Compare against the actual theme's composited band, independent of its hue.
        const sample = document.createElement('canvas').getContext('2d');
        sample.fillStyle = background;
        sample.fillRect(0, 0, 1, 1);
        sample.fillStyle = bandColor;
        sample.fillRect(0, 0, 1, 1);
        const expected = sample.getImageData(0, 0, 1, 1).data;
        let bandPixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            if ([0, 1, 2].every(channel => Math.abs(data[i + channel] - expected[channel]) <= 2)) {
                bandPixels++;
            }
        }
        return bandPixels;
    }, columnLeft, circuitMetrics, CanvasTheme.surface.background, CanvasTheme.interaction.playheadBand);
}

const FIRST_COLUMN_LEFT = circuitMetrics.firstColumnLeft;
const SECOND_COLUMN_LEFT = FIRST_COLUMN_LEFT + circuitMetrics.columnSpacing;
const BANDED_PIXELS = 250;
const UNBANDED_PIXELS = 20;

async function waitForPlayhead(page, expectedPosition, expectedKets) {
    await page.waitForFunction(
        (position, kets) => {
            if (document.getElementById('playhead-position').textContent !== position) {
                return false;
            }
            const shown = [...document.querySelectorAll('#state-table-body tr')].
                filter(row => row.style.display !== 'none').
                map(row => row.cells[0].textContent.trim());
            return shown.join(',') === kets;
        },
        {timeout: TEST_TIMEOUT_MILLIS},
        expectedPosition,
        expectedKets.join(','));
}

async function stateTableRows(page) {
    return page.evaluate(() => [...document.querySelectorAll('#state-table-body tr')].
        filter(row => row.style.display !== 'none').
        map(row => ({
            ket: row.cells[0].textContent.trim(),
            probability: Number.parseFloat(row.cells[1].textContent.trim()),
            amplitude: row.cells[2].textContent.trim(),
            phase: Number.parseFloat(row.cells[3].textContent.trim())
        })));
}

test('steps the circuit with the transport controls and reports the state at the playhead', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['\u2022', 'X']]}, async page => {
        // The strip is the labelled group; the scrub sits beside its buttons, not inside them.
        const transport = await page.$eval('.transport-bar[role="group"]', element => ({
            label: element.getAttribute('aria-label'),
            buttonLabels: Array.from(element.querySelectorAll('[data-slot="button"]'), b => b.textContent),
            scrubMax: element.querySelector('#playhead-scrub').max
        }));

        // The amplitudes at the playhead are their own panel now.
        await page.click('#state-button');
        await waitForPanel(page, 'state', true);
        assert.equal(transport.label, 'Playback controls');
        // ket writes its arrows as ASCII; here they are drawn glyphs, so the labels are the words.
        assert.deepEqual(transport.buttonLabels, ['Reset', 'Prev', 'Play', 'Next', 'End', 'Breakpoint', 'Stop debugging']);
        assert.equal(transport.scrubMax, '2');

        assert.deepEqual(
            await page.$$eval('#state-table thead th', els => els.map(e => e.textContent)),
            ['state', 'probability', 'amplitude', 'phase (deg)']);

        // Nothing has run yet, so the state is the all-zero input and the band marks the first column.
        await waitForPlayhead(page, 'operation 0 / 2', ['|00\u27E9']);
        assert.equal(
            await page.$eval('#state-summary', e => e.textContent),
            '2 qubits \u00B7 4 amplitudes \u00B7 1 nonzero');
        assert.ok(await playheadBandPixels(page, FIRST_COLUMN_LEFT) > BANDED_PIXELS,
            'The playhead band must mark the column about to execute.');
        assert.ok(await playheadBandPixels(page, SECOND_COLUMN_LEFT) < UNBANDED_PIXELS,
            'The playhead band must not mark a column that is not next.');
        assert.equal(await page.$eval('#playhead-prev-button', b => b.disabled), true);

        // The Hadamard has run: an even superposition of the first wire, and the band has moved on.
        await page.click('#playhead-next-button');
        await waitForPlayhead(page, 'operation 1 / 2', ['|00\u27E9', '|01\u27E9']);
        const afterHadamard = await stateTableRows(page);
        assert.deepEqual(afterHadamard.map(e => e.probability), [0.5, 0.5]);
        assert.deepEqual(afterHadamard.map(e => e.phase), [0, 0]);
        assert.ok(await playheadBandPixels(page, SECOND_COLUMN_LEFT) > BANDED_PIXELS,
            'The playhead band must follow the playhead.');
        assert.ok(await playheadBandPixels(page, FIRST_COLUMN_LEFT) < UNBANDED_PIXELS,
            'The playhead band must leave the column it has run.');

        // And now the controlled not, which entangles the wires into a Bell pair.
        await page.click('#playhead-end-button');
        await waitForPlayhead(page, 'operation 2 / 2', ['|00\u27E9', '|11\u27E9']);
        assert.deepEqual((await stateTableRows(page)).map(e => e.probability), [0.5, 0.5]);
        assert.equal(await page.$eval('#playhead-next-button', b => b.disabled), true);
        assert.ok(await playheadBandPixels(page, SECOND_COLUMN_LEFT) < UNBANDED_PIXELS,
            'A circuit that has fully run has no next column to mark.');

        await page.click('#playhead-reset-button');
        await waitForPlayhead(page, 'operation 0 / 2', ['|00\u27E9']);
        assert.equal(await page.$eval('#playhead-scrub', e => e.value), '0');
    });
});

test('transport skips display columns in both directions and highlights the next operation', async browser => {
    await withQuirkPage(browser, {cols: [['Amps1'], ['X'], ['Bloch'], [], ['X'], ['Sample1']]}, async page => {
        await page.click('#state-button');
        await waitForPanel(page, 'state', true);
        await waitForPlayhead(page, 'operation 0 / 2', ['|00⟩']);
        assert.equal(await page.$eval('#playhead-scrub', e => e.max), '2');
        assert.ok(await playheadBandPixels(page, SECOND_COLUMN_LEFT) > BANDED_PIXELS);
        assert.ok(await playheadBandPixels(page, FIRST_COLUMN_LEFT) < UNBANDED_PIXELS);
        await page.click('#playhead-next-button');
        await waitForPlayhead(page, 'operation 1 / 2', ['|01⟩']);
        assert.ok(await playheadBandPixels(page, FIRST_COLUMN_LEFT + 4 * circuitMetrics.columnSpacing) > BANDED_PIXELS);
        await page.click('#playhead-next-button');
        await waitForPlayhead(page, 'operation 2 / 2', ['|00⟩']);
        assert.equal(await page.$eval('#playhead-next-button', e => e.disabled), true);
        await page.click('#playhead-prev-button');
        await waitForPlayhead(page, 'operation 1 / 2', ['|01⟩']);
        await page.$eval('#playhead-scrub', e => {
            e.value = '0';
            e.dispatchEvent(new Event('input', {bubbles: true}));
        });
        await waitForPlayhead(page, 'operation 0 / 2', ['|00⟩']);
    });
});

test('a transport command starts the debugging, where t moves only with the playhead, an increment a step', async browser => {
    // Each recorded take keeps the phase it was taken at, in full; a context of its own keeps the
    // tape to this test's takes.
    const context = await browser.createBrowserContext();
    try {
        await withQuirkPage(context, {cols: [['H'], [{id: 'Rzft', arg: 'pi t'}], ['X']]}, async page => {
            let taken = 0;
            const phase = async () => {
                await page.click('#record-take');
                taken++;
                await page.waitForFunction(
                    expected => document.querySelectorAll('.take-card:not(.take-ghost)').length === expected,
                    {timeout: TEST_TIMEOUT_MILLIS}, taken);
                return page.evaluate(name => new Promise((resolve, reject) => {
                    const request = indexedDB.open('shadow-quant-tape', 1);
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => {
                        const db = request.result;
                        const read = db.transaction('takes').objectStore('takes').getAll();
                        read.onsuccess = () => {
                            db.close();
                            resolve(read.result.find(r => !r.ghost && r.take.name === name).take.phase);
                        };
                        read.onerror = () => {db.close(); reject(read.error);};
                    };
                }), `take ${taken}`);
            };
            const position = text => page.waitForFunction(
                expected => document.getElementById('playhead-position').textContent.startsWith(expected),
                {timeout: 2000}, text);
            const apart = (a, b) => Math.abs((((a - b) % 1) + 1.5) % 1 - 0.5);

            // Nothing is debugged until the transport is used, and there is nothing to stop.
            assert.equal(await page.$eval('#debug-stop-button', b => b.disabled), true);
            await page.click('#playhead-next-button');
            await position('operation 1');
            await page.waitForSelector('#debug-stop-button:not([disabled])');
            const parked = await phase();
            await new Promise(resolve => setTimeout(resolve, 300));
            assert.equal(await phase(), parked, 'A debugged circuit must not move on its own.');

            await page.click('#playhead-next-button');
            await position('operation 2');
            assert.ok(apart(await phase(), parked + 1 / 32) < 1e-9, 'A step moves t by one increment.');
            await page.click('#playhead-prev-button');
            await position('operation 1');
            assert.ok(apart(await phase(), parked) < 1e-9, 'A step back shows the step as it was.');

            // Stopping returns to the start, an increment below the first step, and runs on from there.
            await page.click('#debug-stop-button');
            await position('operation 0');
            await page.waitForSelector('#debug-stop-button[disabled]');
            await new Promise(resolve => setTimeout(resolve, 300));
            assert.ok(apart(await phase(), parked - 1 / 32) > 1e-3, 'A circuit no longer debugged moves on its own.');
        });
    } finally {
        await context.close();
    }
});

test('a run halts before a breakpoint and before an assertion that fails', async browser => {
    // Wire 1 is never put in superposition, so the assertion on it fails.
    await withQuirkPage(browser, {cols: [['H'], ['X'], ['Z'], [1, 'assert-sup1'], ['Y']]}, async page => {
        const position = text => page.waitForFunction(
            expected => document.getElementById('playhead-position').textContent.trim() === expected,
            {timeout: 2000}, text);
        // The breakpoint goes on the operation the playhead stands before: Next, then the X column.
        await page.click('#playhead-next-button');
        await position('operation 1 / 4');
        assert.equal(await page.$eval('#breakpoint-toggle-button', b => b.getAttribute('aria-pressed')), 'false');
        await page.click('#breakpoint-toggle-button');
        await page.waitForSelector('#breakpoint-toggle-button[aria-pressed="true"]');

        await page.click('#playhead-reset-button');
        await position('operation 0 / 4');
        await page.click('#playhead-end-button');
        await position('operation 1 / 4');
        // On from the breakpoint, the failing assertion on wire 1 halts the run before its column.
        await page.click('#playhead-end-button');
        await position('operation 3 / 4');
        await page.click('#playhead-end-button');
        await position('operation 4 / 4');
    });
});

test('breakpoints travel in the link, beside the circuit and outside the history', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['X'], ['Z']]}, async page => {
        const position = text => page.waitForFunction(
            expected => document.getElementById('playhead-position').textContent.trim() === expected,
            {timeout: 2000}, text);
        const entries = await page.evaluate(() => history.length);
        const app = await page.evaluate(() => document.location.origin + document.location.pathname);

        await page.click('#playhead-next-button');
        await position('operation 1 / 3');
        await page.click('#breakpoint-toggle-button');
        await page.waitForFunction(() => document.location.hash.endsWith('&breakpoints=1'), {timeout: 2000});
        assert.equal(await page.evaluate(() => history.length), entries, 'A breakpoint is no step in the history.');

        // The link alone brings the breakpoint back: a run from the start halts before the X.
        await page.goto('about:blank');
        // Column 7 holds no operation, and is skipped.
        await page.goto(`${app}#circuit={"cols":[["H"],["X"],["Z"]]}&breakpoints=1,7`);
        await page.waitForSelector('#playhead-end-button:not([disabled])');
        await page.click('#playhead-end-button');
        await position('operation 1 / 3');
        await page.waitForSelector('#breakpoint-toggle-button[aria-pressed="true"]');

        await page.click('#breakpoint-toggle-button');
        await page.waitForFunction(() => !document.location.hash.includes('breakpoints'), {timeout: 2000});
    });
});

test('toggles playback with the space bar', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['X'], ['Z'], ['H']]}, async page => {
        await page.keyboard.press('Space');
        await page.waitForFunction(
            () => document.getElementById('playhead-play-label').textContent === 'Pause',
            {timeout: TEST_TIMEOUT_MILLIS});

        await page.keyboard.press('Space');
        await page.waitForFunction(
            () => document.getElementById('playhead-play-label').textContent === 'Play',
            {timeout: TEST_TIMEOUT_MILLIS});
    });
});

test('scrubbing to a gate stops playback', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['X'], ['Z'], ['H']]}, async page => {
        // The label and the readout follow the playhead's state ticks, so each expectation is
        // awaited rather than sampled once.
        await page.click('#playhead-play-button');
        await page.waitForFunction(
            () => document.getElementById('playhead-play-label').textContent === 'Pause',
            {timeout: TEST_TIMEOUT_MILLIS});

        await page.$eval('#playhead-scrub', element => {
            element.value = '3';
            element.dispatchEvent(new Event('input', {bubbles: true}));
        });

        await page.waitForFunction(
            () => document.getElementById('playhead-play-label').textContent === 'Play',
            {timeout: TEST_TIMEOUT_MILLIS});
        await page.waitForFunction(
            () => document.getElementById('playhead-position').textContent === 'operation 3 / 4',
            {timeout: TEST_TIMEOUT_MILLIS});
        assert.equal(await page.$eval('#playhead-position', e => e.textContent), 'operation 3 / 4');
    });
});

test('houses the transport in the shell below the work area', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['X']]}, async page => {
        // The transport is the shell's own bottom strip now, not a band inside a panel: it stays
        // put whatever the dock is showing.
        const placement = await page.evaluate(() => {
            const transport = document.querySelector('.transport-bar');
            const work = document.querySelector('.app-dock');
            return {
                insideAPanel: transport.closest('[data-panel-id]') !== null,
                belowTheWorkArea:
                    transport.getBoundingClientRect().top >= work.getBoundingClientRect().bottom - 1,
            };
        });
        assert.equal(placement.insideAPanel, false, 'The transport must not live inside a panel.');
        assert.ok(placement.belowTheWorkArea, 'The transport must sit below the work area.');

        await page.click('#playhead-next-button');
        await page.waitForFunction(
            () => document.getElementById('playhead-position').textContent.startsWith('operation 1'),
            {timeout: 2000});
    });
});
