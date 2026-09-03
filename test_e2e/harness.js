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

// The end-to-end harness: the test registry, the built page, and the waits every spec shares.
// Specs register with test(name, body) at import time; the runner in
// ../PuppeteerRunEndToEndTests.js imports them and runs the registry.

import assert from 'node:assert/strict';

const DEFAULT_VIEWPORT = {width: 1280, height: 720, deviceScaleFactor: 1};
const TEST_TIMEOUT_MILLIS = 10 * 1000;

const tests = [];

/** Where the built app is served from; the runner sets this before running the registry. */
let appOrigin = undefined;

function setAppOrigin(origin) {
    appOrigin = origin;
}

function test(name, body) {
    tests.push({name, body});
}

function urlForCircuit(circuit) {
    const url = new URL('/quirk.html', appOrigin);
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

// The overlays are Base UI Dialogs kept mounted while closed, so open/closed is the popup's
// computed visibility rather than an inline display style.
async function waitForDialog(page, selector, expectedOpen) {
    await page.waitForFunction(
        (targetSelector, open) => {
            const element = document.querySelector(targetSelector);
            if (element === null) {
                return !open;
            }
            return (getComputedStyle(element).display !== 'none' && !element.hidden) === open;
        },
        {timeout: TEST_TIMEOUT_MILLIS},
        selector,
        expectedOpen);
}

async function exportedCircuit(page) {
    await page.click('#export-button');
    await waitForDialog(page, '#export-div', true);
    const jsonText = await page.$eval('#export-circuit-json-pre', element => element.textContent);
    await page.keyboard.press('Escape');
    await waitForDialog(page, '#export-div', false);
    return JSON.parse(jsonText);
}

async function withQuirkPage(browser, circuit, body, viewport=DEFAULT_VIEWPORT, allowedConsoleErrors=[]) {
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
        // Tests that deliberately trigger a recovery allow the reporter's own console line.
        let unexpectedErrors = browserErrors.filter(e => !allowedConsoleErrors.some(regex => regex.test(e)));
        assert.deepEqual(unexpectedErrors, [], 'The page must not report browser errors.');
    } catch (error) {
        failure = error;
    } finally {
        await page.close();
    }

    if (failure !== undefined) {
        throw failure;
    }
}

/**
 * Waits until the canvas viewport matches its scroll cell, which is also when the last paint used
 * the cell's current size. Pixel samples taken before that race the throttled repaint that
 * follows a layout change, such as the state table filling in.
 */
async function waitForCanvasViewport(page) {
    await page.waitForFunction(
        () => {
            const canvas = document.getElementById('drawCanvas');
            const div = document.getElementById('canvasDiv');
            const dpr = window.devicePixelRatio || 1;
            return canvas.width === Math.round(div.clientWidth * dpr) &&
                canvas.height === Math.round(div.clientHeight * dpr);
        },
        {timeout: TEST_TIMEOUT_MILLIS});
}

/**
 * Where the circuit band starts inside the canvas, in circuit units: centered in the visible
 * area, but never above the top margin. Mirrors DisplayedInspector.updateArea.
 */
async function circuitTopForWires(page, wireCount, zoom = 1) {
    return page.evaluate((wireCount, zoom) => {
        const margin = 24;  // Layout.CIRCUIT_TOP_MARGIN.
        const band = wireCount * 50 + 105;  // Wire band plus the label and warning strips.
        const div = document.getElementById('canvasDiv');
        const sceneHeight = Math.max(div.clientHeight / zoom, band + 2 * margin);
        return Math.max(margin, Math.floor((sceneHeight - band) / 2));
    }, wireCount, zoom);
}

// Shared by the circuit and toolbox specs: both check that the circuit paints where the layout
// says it should.
async function canvasLayout(page) {
    await waitForCanvasViewport(page);
    return page.evaluate(() => {
        const canvas = document.getElementById('drawCanvas');
        const context = canvas.getContext('2d');
        const canvasBounds = canvas.getBoundingClientRect();
        // The circuit band centers vertically; mirror the app's own layout for a 2-wire circuit.
        const circuitBand = 2 * 50 + 105;
        const circuitTop = Math.max(
            24,
            Math.floor((Math.max(canvas.clientHeight, circuitBand + 48) - circuitBand) / 2));

        const pixelAt = (x, y) => {
            const data = context.getImageData(x, y, 1, 1).data;
            return [data[0], data[1], data[2], data[3]];
        };
        const countRegion = (x, y, width, height) => {
            // The canvas paints a real dark theme; the circuit background is #14161D.
            const background = [20, 22, 29];
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
                top: canvasBounds.top,
                left: canvasBounds.left
            },
            circuitTop,
            toolbox: (() => {
                const aside = document.querySelector('.gate-toolbox');
                const bounds = aside.getBoundingClientRect();
                return {
                    right: bounds.right,
                    bottom: bounds.bottom,
                    width: bounds.width,
                    tileCount: aside.querySelectorAll('.gate-tile').length
                };
            })(),
            circuitTopPixel: pixelAt(10, 10),
            blochGateRegion: countRegion(85, circuitTop + 5, 40, 40),
            emptyCircuitRegion: countRegion(135, circuitTop + 5, 40, 40)
        };
    });
}

function assertCircuitLayout(layout) {
    // The gate toolbox is a DOM sidebar, so the canvas is nothing but circuit and the first wire
    // is on screen without scrolling past a hundred gate tiles.
    assert.ok(layout.toolbox.tileCount > 90, `The sidebar must hold the gates, saw ${layout.toolbox.tileCount}.`);
    assert.ok(
        layout.canvas.left >= layout.toolbox.right - 1,
        'The circuit canvas must sit beside the gate toolbox, not below it.');
    assert.deepEqual(layout.circuitTopPixel, [20, 22, 29, 255]);
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

export {
    setAppOrigin,
    test,
    tests,
    urlForCircuit,
    waitForQuirk,
    currentCircuit,
    waitForCircuit,
    waitForDialog,
    exportedCircuit,
    withQuirkPage,
    TEST_TIMEOUT_MILLIS,
    canvasLayout,
    assertCircuitLayout,
    circuitTopForWires,
    waitForCanvasViewport,
};