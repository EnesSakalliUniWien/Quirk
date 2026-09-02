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

const assert = require('node:assert/strict');
const {test, withQuirkPage, waitForQuirk, waitForCircuit, waitForDialog, currentCircuit, exportedCircuit, urlForCircuit, TEST_TIMEOUT_MILLIS, waitForCanvasViewport} = require('./harness.js');

async function playheadBandPixels(page, columnLeft) {
    await waitForCanvasViewport(page);
    return page.evaluate(left => {
        const canvas = document.getElementById('drawCanvas');
        const context = canvas.getContext('2d');
        // The strip between this spec's two wire rows; the circuit band centers vertically, so
        // the sample follows the same layout the app computes.
        const div = document.getElementById('canvasDiv');
        const band = 2 * 50 + 105;
        const top = Math.max(24, Math.floor((Math.max(div.clientHeight, band + 48) - band) / 2));
        const data = context.getImageData(left - 3, top + 46, 46, 8).data;
        let amber = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] > data[i + 1] + 15 && data[i + 1] > data[i + 2] + 15 && data[i] > 40) {
                amber++;
            }
        }
        return amber;
    }, columnLeft);
}

const FIRST_COLUMN_LEFT = 32;
const SECOND_COLUMN_LEFT = 82;
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
        const transport = await page.$eval('#transport-bar-root [role="group"]', element => ({
            label: element.getAttribute('aria-label'),
            buttonLabels: Array.from(element.querySelectorAll('[data-slot="button"]'), b => b.textContent),
            scrubMax: element.querySelector('#playhead-scrub').max
        }));
        assert.equal(transport.label, 'Playback controls');
        // ket writes its arrows as ASCII; here they are drawn glyphs, so the labels are the words.
        assert.deepEqual(transport.buttonLabels, ['Reset', 'Prev', 'Play', 'Next', 'End']);
        assert.equal(transport.scrubMax, '2');

        assert.deepEqual(
            await page.$$eval('#state-table thead th', els => els.map(e => e.textContent)),
            ['state', 'probability', 'amplitude', 'phase (deg)']);

        // Nothing has run yet, so the state is the all-zero input and the band marks the first column.
        await waitForPlayhead(page, 'gate 0 / 2', ['|00\u27E9']);
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
        await waitForPlayhead(page, 'gate 1 / 2', ['|00\u27E9', '|01\u27E9']);
        let afterHadamard = await stateTableRows(page);
        assert.deepEqual(afterHadamard.map(e => e.probability), [0.5, 0.5]);
        assert.deepEqual(afterHadamard.map(e => e.phase), [0, 0]);
        assert.ok(await playheadBandPixels(page, SECOND_COLUMN_LEFT) > BANDED_PIXELS,
            'The playhead band must follow the playhead.');
        assert.ok(await playheadBandPixels(page, FIRST_COLUMN_LEFT) < UNBANDED_PIXELS,
            'The playhead band must leave the column it has run.');

        // And now the controlled not, which entangles the wires into a Bell pair.
        await page.click('#playhead-end-button');
        await waitForPlayhead(page, 'gate 2 / 2', ['|00\u27E9', '|11\u27E9']);
        assert.deepEqual((await stateTableRows(page)).map(e => e.probability), [0.5, 0.5]);
        assert.equal(await page.$eval('#playhead-next-button', b => b.disabled), true);
        assert.ok(await playheadBandPixels(page, SECOND_COLUMN_LEFT) < UNBANDED_PIXELS,
            'A circuit that has fully run has no next column to mark.');

        await page.click('#playhead-reset-button');
        await waitForPlayhead(page, 'gate 0 / 2', ['|00\u27E9']);
        assert.equal(await page.$eval('#playhead-scrub', e => e.value), '0');
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
        await page.click('#playhead-play-button');
        assert.equal(await page.$eval('#playhead-play-label', e => e.textContent), 'Pause');

        await page.$eval('#playhead-scrub', element => {
            element.value = '3';
            element.dispatchEvent(new Event('input', {bubbles: true}));
        });

        await page.waitForFunction(
            () => document.getElementById('playhead-play-label').textContent === 'Play',
            {timeout: TEST_TIMEOUT_MILLIS});
        assert.equal(await page.$eval('#playhead-position', e => e.textContent), 'gate 3 / 4');
    });
});
