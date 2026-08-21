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

const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const puppeteer = require('puppeteer');

const APP_FILE_URL = pathToFileURL(path.join(__dirname, 'out', 'quirk.html'));
const DEFAULT_VIEWPORT = {width: 1280, height: 720, deviceScaleFactor: 1};
const TEST_TIMEOUT_MILLIS = 10 * 1000;

const tests = [];

function test(name, body) {
    tests.push({name, body});
}

function urlForCircuit(circuit) {
    const url = new URL(APP_FILE_URL);
    url.hash = 'circuit=' + encodeURIComponent(JSON.stringify(circuit));
    return url.href;
}

async function waitForQuirk(page) {
    await page.waitForSelector('#loading-div', {hidden: true, timeout: TEST_TIMEOUT_MILLIS});
    await page.waitForFunction(
        () => {
            const inspector = document.getElementById('inspectorDiv');
            const canvas = document.getElementById('drawCanvas');
            return inspector.style.display !== 'none' && canvas.width > 0 && canvas.height > 0;
        },
        {timeout: TEST_TIMEOUT_MILLIS});
}

async function currentCircuit(page) {
    return page.evaluate(() => {
        const params = new URLSearchParams(document.location.hash.substring(1));
        const jsonText = params.get('circuit');
        return jsonText === null ? {cols: []} : JSON.parse(jsonText);
    });
}

async function waitForCircuit(page, expectedCircuit) {
    const expectedJson = JSON.stringify(expectedCircuit);
    await page.waitForFunction(
        expected => {
            const params = new URLSearchParams(document.location.hash.substring(1));
            const jsonText = params.get('circuit');
            const actual = jsonText === null ? {cols: []} : JSON.parse(jsonText);
            return JSON.stringify(actual) === expected;
        },
        {timeout: TEST_TIMEOUT_MILLIS},
        expectedJson);
}

async function waitForDisplay(page, selector, expectedDisplay) {
    await page.waitForFunction(
        (targetSelector, display) => document.querySelector(targetSelector)?.style.display === display,
        {timeout: TEST_TIMEOUT_MILLIS},
        selector,
        expectedDisplay);
}

async function exportedCircuit(page) {
    await page.click('#export-button');
    await waitForDisplay(page, '#export-div', 'block');
    const jsonText = await page.$eval('#export-circuit-json-pre', element => element.textContent);
    await page.keyboard.press('Escape');
    await waitForDisplay(page, '#export-div', 'none');
    return JSON.parse(jsonText);
}

async function canvasLayout(page) {
    return page.evaluate(() => {
        const canvas = document.getElementById('drawCanvas');
        const context = canvas.getContext('2d');
        const canvasBounds = canvas.getBoundingClientRect();
        const toolboxBottom = 292;
        const toolboxCircuitMargin = 24;  // Carbon $spacing-lg.
        const circuitTop = toolboxBottom + toolboxCircuitMargin;

        const pixelAt = (x, y) => {
            const data = context.getImageData(x, y, 1, 1).data;
            return [data[0], data[1], data[2], data[3]];
        };
        const countRegion = (x, y, width, height) => {
            // The canvas paints a real dark theme; the circuit background is #0A0A0A.
            const background = [10, 10, 10];
            const data = context.getImageData(x, y, width, height).data;
            let painted = 0;
            let greenish = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (Math.abs(data[i] - background[0]) > 6 ||
                        Math.abs(data[i + 1] - background[1]) > 6 ||
                        Math.abs(data[i + 2] - background[2]) > 6) {
                    painted++;
                }
                if (data[i + 1] > data[i] + 10 && data[i + 1] > data[i + 2] + 10) {
                    greenish++;
                }
            }
            return {painted, greenish};
        };

        return {
            viewport: {width: innerWidth, height: innerHeight},
            canvas: {
                width: canvas.width,
                height: canvas.height,
                top: canvasBounds.top
            },
            toolboxBottom,
            circuitTop,
            toolboxTopPixel: pixelAt(10, 10),
            toolboxBottomPixel: pixelAt(10, toolboxBottom - 1),
            blochGateRegion: countRegion(85, circuitTop + 5, 40, 40),
            emptyCircuitRegion: countRegion(135, circuitTop + 5, 40, 40)
        };
    });
}

function assertCircuitLayout(layout) {
    assert.ok(layout.circuitTop >= layout.toolboxBottom, 'The circuit must remain below both toolboxes.');
    assert.deepEqual(layout.toolboxTopPixel, [24, 24, 27, 255]);
    assert.deepEqual(layout.toolboxBottomPixel, [24, 24, 27, 255]);
    assert.ok(
        layout.blochGateRegion.painted > 1000,
        'The Bloch sphere must be painted in its circuit gate slot.');
    assert.ok(
        layout.blochGateRegion.greenish > 20,
        'The rendered circuit Bloch sphere must include its state indicator.');
    assert.ok(
        layout.emptyCircuitRegion.painted < 200,
        'The neighboring empty circuit slot should not contain a display gate.');
}

async function withQuirkPage(browser, circuit, body, viewport=DEFAULT_VIEWPORT) {
    const page = await browser.newPage();
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(`page error: ${error.message}`));
    page.on('console', message => {
        if (message.type() === 'error') {
            browserErrors.push(`console error: ${message.text()}`);
        }
    });

    let failure;
    try {
        await page.setViewport(viewport);
        await page.goto(urlForCircuit(circuit));
        await waitForQuirk(page);
        await body(page);
        assert.deepEqual(browserErrors, [], 'The page must not report browser errors.');
    } catch (error) {
        failure = error;
    } finally {
        await page.close();
    }

    if (failure !== undefined) {
        throw failure;
    }
}

test('loads a URL circuit and renders its Bloch sphere in the circuit area', async browser => {
    const circuit = {cols: [['H'], ['Bloch']]};
    await withQuirkPage(browser, circuit, async page => {
        assert.equal(await page.$eval('#menu-div', element => element.style.display), 'none');
        assert.deepEqual(await exportedCircuit(page), circuit);
        assertCircuitLayout(await canvasLayout(page));
    });
});

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

test('drags a gate onto a wire and supports undo, redo, and clear actions', async browser => {
    await withQuirkPage(browser, {cols: []}, async page => {
        await page.click('#close-menu-button');

        const canvasBounds = await page.$eval('#drawCanvas', element => {
            const bounds = element.getBoundingClientRect();
            return {x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height};
        });
        const halfTurnH = {
            x: canvasBounds.x + 260,
            y: canvasBounds.y + 106
        };
        const firstWireFirstColumn = {
            x: canvasBounds.x + 55,
            y: canvasBounds.y + 292 + 24 + 25
        };

        await page.mouse.move(halfTurnH.x, halfTurnH.y);
        await page.mouse.down();
        await page.mouse.move(firstWireFirstColumn.x, firstWireFirstColumn.y, {steps: 10});
        await page.mouse.up();

        const circuitWithH = {cols: [['H']]};
        const emptyCircuit = {cols: []};
        await waitForCircuit(page, circuitWithH);
        assert.equal(await page.$eval('#undo-button', button => button.disabled), false);
        assert.equal(await page.$eval('#redo-button', button => button.disabled), true);

        await page.click('#undo-button');
        await waitForCircuit(page, emptyCircuit);
        assert.equal(await page.$eval('#redo-button', button => button.disabled), false);

        await page.click('#redo-button');
        await waitForCircuit(page, circuitWithH);

        await page.click('#clear-circuit-button');
        await waitForCircuit(page, emptyCircuit);

        await page.click('#undo-button');
        await waitForCircuit(page, circuitWithH);
        await page.click('#clear-all-button');
        await waitForCircuit(page, emptyCircuit);
        assert.deepEqual(await currentCircuit(page), emptyCircuit);
    });
});

test('undoes and redoes with both the control and command modifiers', async browser => {
    const circuitWithH = {cols: [['H']]};
    const emptyCircuit = {cols: []};
    await withQuirkPage(browser, circuitWithH, async page => {
        // Command is the primary modifier on macOS; control is the primary modifier elsewhere.
        for (const modifier of ['Meta', 'Control']) {
            await page.click('#clear-circuit-button');
            await waitForCircuit(page, emptyCircuit);

            await page.keyboard.down(modifier);
            await page.keyboard.press('KeyZ');
            await page.keyboard.up(modifier);
            await waitForCircuit(page, circuitWithH);

            await page.keyboard.down(modifier);
            await page.keyboard.down('Shift');
            await page.keyboard.press('KeyZ');
            await page.keyboard.up('Shift');
            await page.keyboard.up(modifier);
            await waitForCircuit(page, emptyCircuit);
        }
    });
});

test('opens and closes the menu, export, and gate forge overlays', async browser => {
    const circuit = {cols: [['H']]};
    await withQuirkPage(browser, circuit, async page => {
        await page.click('#menu-button');
        await waitForDisplay(page, '#menu-div', 'block');
        assert.equal(await page.$eval('#export-button', button => button.disabled), true);
        await page.keyboard.press('Escape');
        await waitForDisplay(page, '#menu-div', 'none');

        await page.click('#export-button');
        await waitForDisplay(page, '#export-div', 'block');
        const jsonText = await page.$eval('#export-circuit-json-pre', element => element.textContent);
        assert.deepEqual(JSON.parse(jsonText), circuit);
        await page.keyboard.press('Escape');
        await waitForDisplay(page, '#export-div', 'none');
        assert.equal(await page.$eval('#menu-button', button => button.disabled), false);

        await page.click('#gate-forge-button');
        await waitForDisplay(page, '#gate-forge-div', 'block');
        const forge = await page.$eval('.forge-dialog', element => ({
            title: element.querySelector('.dialog-title')?.textContent,
            methodCount: element.querySelectorAll('.forge-method').length,
            activeElementId: document.activeElement?.id
        }));
        assert.equal(forge.title, 'Make a gate');
        assert.equal(forge.methodCount, 3);
        assert.equal(forge.activeElementId, 'gate-forge-rotation-axis');
        await page.keyboard.press('Escape');
        await waitForDisplay(page, '#gate-forge-div', 'none');
    });
});

test('keeps the circuit below the toolboxes when the viewport is resized', async browser => {
    const circuit = {cols: [['H'], ['Bloch']]};
    await withQuirkPage(browser, circuit, async page => {
        const wideLayout = await canvasLayout(page);
        assertCircuitLayout(wideLayout);
        assert.equal(wideLayout.circuitTop, wideLayout.toolboxBottom + 24);

        // Canvas height hugs the content: toolboxes (292) + margin (24) + circuit (2 wires * 50 + 105).
        await page.setViewport({width: 700, height: 480, deviceScaleFactor: 1});
        await page.waitForFunction(
            () => innerWidth === 700 && innerHeight === 480 && document.getElementById('drawCanvas').height === 521,
            {timeout: TEST_TIMEOUT_MILLIS});

        const compactLayout = await canvasLayout(page);
        assertCircuitLayout(compactLayout);
        assert.ok(compactLayout.canvas.top > wideLayout.canvas.top, 'The wrapped toolbar must remain above the canvas.');
        assert.equal(compactLayout.circuitTop, compactLayout.toolboxBottom + 24);
    });
});

(async () => {
    let browser;
    let completed = 0;
    try {
        browser = await puppeteer.launch();
        console.log(`Running ${tests.length} end-to-end tests...`);
        for (const {name, body} of tests) {
            try {
                await body(browser);
                completed++;
                console.log(`PASS ${name}`);
            } catch (error) {
                console.error(`FAIL ${name}`);
                console.error(error.stack || error);
                process.exitCode = 1;
            }
        }
        console.log(`Completed ${completed}/${tests.length} end-to-end tests.`);
        if (completed !== tests.length) {
            process.exitCode = 1;
        }
    } catch (error) {
        console.error('Error bubbled up into PuppeteerRunEndToEndTests.js: ' + error.stack);
        process.exitCode = 1;
    } finally {
        if (browser !== undefined) {
            await browser.close();
        }
    }
})();
