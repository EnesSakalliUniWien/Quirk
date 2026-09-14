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
// ../scripts/run-e2e-tests.js imports them and runs the registry.

import assert from 'node:assert/strict';
import {CanvasTheme} from '../src/config/CanvasTheme.js';
import {Layout} from '../src/config/Layout.js';
import {CIRCUIT_OP_LEFT_SPACING, CIRCUIT_BOTTOM_MARGIN} from '../src/editor/geometry/CircuitLayoutConstants.js';

const circuitMetrics = {
    wireSpacing: Layout.WIRE_SPACING, columnSpacing: Layout.COLUMN_SPACING,
    gateSize: 2 * Layout.GATE_RADIUS, firstColumnLeft: CIRCUIT_OP_LEFT_SPACING,
    topMargin: Layout.CIRCUIT_TOP_MARGIN, bottomMargin: CIRCUIT_BOTTOM_MARGIN,
    blochRadius: Layout.BLOCH_RADIUS,
    background: CanvasTheme.surface.background.slice(1).match(/../g).map(v => Number.parseInt(v, 16))
};

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
    const url = new URL('/', appOrigin);
    url.hash = 'circuit=' + encodeURIComponent(JSON.stringify(circuit));
    return url.href;
}

async function waitForQuirk(page) {
    await page.waitForFunction(
        () => {
            const inspector = document.getElementById('inspectorDiv');
            const canvas = document.querySelector('#drawCanvas canvas');
            return inspector.style.visibility !== 'hidden' && canvas.width > 0 && canvas.height > 0 && canvas.parentElement.dataset.renderer === 'pixijs';
        },
        {timeout: TEST_TIMEOUT_MILLIS});
}

// Circuit hashes use URI encoding, so a literal + is a ket sign, not a form-encoded space.
async function currentCircuit(page) {
    return page.evaluate(() => {
        const params = new URLSearchParams(document.location.hash.slice(1).replace(/\+/g, '%2B'));
        const jsonText = params.get('circuit');
        return jsonText === null ? {cols: []} : JSON.parse(jsonText);
    });
}

async function waitForCircuit(page, expectedCircuit) {
    const expectedJson = JSON.stringify(expectedCircuit);
    await page.waitForFunction(
        expected => {
            const params = new URLSearchParams(document.location.hash.slice(1).replace(/\+/g, '%2B'));
            const jsonText = params.get('circuit');
            const actual = jsonText === null ? {cols: []} : JSON.parse(jsonText);
            return JSON.stringify(actual) === expected &&
                document.getElementById('drawCanvas')?.dataset.circuit === expected;
        },
        {timeout: TEST_TIMEOUT_MILLIS},
        expectedJson);
}

/**
 * Every panel carries the name the dock opens it by, stamped by the panel registry. It is the only
 * way these tests identify a panel: a panel that is not showing has no DOM at all, so presence is
 * openness.
 */
const panelSelector = name => `[data-panel-id="${name}"]`;

async function waitForPanel(page, name, expectedOpen) {
    await page.waitForFunction(
        (selector, open) => (document.querySelector(selector) !== null) === open,
        {timeout: TEST_TIMEOUT_MILLIS},
        panelSelector(name),
        expectedOpen);
}

/** Closes a panel through its tab's close control, the way a user would. */
async function closePanel(page, name) {
    await page.evaluate(selector => {
        const panel = document.querySelector(selector);
        const group = panel.closest('.dv-groupview');
        const tabs = [...group.querySelectorAll('.dv-tab')];
        const active = tabs.find(tab => tab.classList.contains('dv-active-tab')) ?? tabs[0];
        active.querySelector('.dv-default-tab-action').click();
    }, panelSelector(name));
    await waitForPanel(page, name, false);
}

async function exportedCircuit(page) {
    await page.click('#export-button');
    await waitForPanel(page, 'export', true);
    const jsonText = await page.$eval('#export-circuit-json-pre', element => element.textContent);
    await closePanel(page, 'export');
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
        // The dock remembers its arrangement, and the whole suite shares one browser: without this
        // a test that opens a panel would leave the circuit half width for every test after it.
        await page.evaluateOnNewDocument(() => {
            try {
                window.localStorage.removeItem('shadow-quant.dock-layout');
            } catch {
                // A browser that refuses site data is already starting clean.
            }
        });
        await page.setViewport(viewport);
        await page.goto(urlForCircuit(circuit));
        await waitForQuirk(page);
        await body(page);
        // Tests that deliberately trigger a recovery allow the reporter's own console line.
        const unexpectedErrors = browserErrors.filter(e => !allowedConsoleErrors.some(regex => regex.test(e)));
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
            const canvas = document.querySelector('#drawCanvas canvas');
            const div = document.getElementById('canvasDiv');
            const dpr = window.devicePixelRatio || 1;
            return canvas.width === Math.round(div.clientWidth * dpr) &&
                canvas.height === Math.round(div.clientHeight * dpr);
        },
        {timeout: TEST_TIMEOUT_MILLIS});
}

/**
 * Where the circuit band starts inside the canvas, in circuit units: centered in the visible
 * area, but never above the top margin. Mirrors EditorState.updateArea.
 */
async function circuitTopForWires(page, wireCount, zoom = 1) {
    return page.evaluate((wireCount, zoom, m) => {
        const margin = m.topMargin;
        const band = (wireCount - 0.5) * m.wireSpacing + m.gateSize / 2 + m.bottomMargin;
        const div = document.getElementById('canvasDiv');
        const sceneHeight = Math.max(div.clientHeight / zoom, band + 2 * margin);
        return Math.max(margin, Math.floor((sceneHeight - band) / 2));
    }, wireCount, zoom, circuitMetrics);
}

// Shared by the circuit and toolbox specs: both check that the circuit paints where the layout
// says it should.
async function canvasLayout(page) {
    await waitForCanvasViewport(page);
    return page.evaluate(m => {
        const canvas = document.querySelector('#drawCanvas canvas');
        const copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d');
        context.drawImage(canvas, 0, 0);
        const canvasBounds = canvas.getBoundingClientRect();
        // The circuit band centers vertically; mirror the app's own layout for a 2-wire circuit.
        const circuitBand = 1.5 * m.wireSpacing + m.gateSize / 2 + m.bottomMargin;
        const circuitTop = Math.max(
            m.topMargin,
            Math.floor((Math.max(canvas.clientHeight, circuitBand + 2 * m.topMargin) - circuitBand) / 2));

        const pixelAt = (x, y) => {
            const data = context.getImageData(x, y, 1, 1).data;
            return [data[0], data[1], data[2], data[3]];
        };
        const countRegion = (x, y, width, height) => {
            const background = m.background;
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
            blochGateRegion: countRegion(m.firstColumnLeft + m.columnSpacing + m.gateSize / 2 - m.blochRadius,
                circuitTop + m.wireSpacing / 2 - m.blochRadius, 2 * m.blochRadius, 2 * m.blochRadius),
            emptyCircuitRegion: countRegion(m.firstColumnLeft + 2 * m.columnSpacing,
                circuitTop + m.wireSpacing / 2 - m.gateSize / 2, m.gateSize, m.gateSize)
        };
    }, circuitMetrics);
}

function assertCircuitLayout(layout) {
    // The gate toolbox is a DOM sidebar, so the canvas is nothing but circuit and the first wire
    // is on screen without scrolling past a hundred gate tiles.
    assert.ok(layout.toolbox.tileCount > 90, `The sidebar must hold the gates, saw ${layout.toolbox.tileCount}.`);
    assert.ok(
        layout.canvas.left >= layout.toolbox.right - 1,
        'The circuit canvas must sit beside the gate toolbox, not below it.');
    assert.deepEqual(layout.circuitTopPixel, [...circuitMetrics.background, 255]);
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
    circuitMetrics,
    setAppOrigin,
    test,
    tests,
    urlForCircuit,
    waitForQuirk,
    currentCircuit,
    waitForCircuit,
    waitForPanel,
    closePanel,
    exportedCircuit,
    withQuirkPage,
    TEST_TIMEOUT_MILLIS,
    canvasLayout,
    assertCircuitLayout,
    circuitTopForWires,
    waitForCanvasViewport,
};