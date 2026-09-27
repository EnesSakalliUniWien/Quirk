// Using the circuit without a mouse - by keyboard, by touch, with Reduce Motion - and the platform
// conventions the pointer follows.

import assert from 'node:assert/strict';
import {
    test, withQuirkPage, waitForCircuit, waitForQuirk, waitForCanvasViewport, circuitTopForWires, circuitMetrics,
    TEST_TIMEOUT_MILLIS,
} from './harness.js';

/** The centre of a cell of the circuit, in page coordinates. */
async function cellCentre(page, wireCount, col, row) {
    await waitForCanvasViewport(page);
    const canvas = await page.$eval('#drawCanvas canvas', element => {
        const bounds = element.getBoundingClientRect();
        return {x: bounds.x, y: bounds.y};
    });
    const top = await circuitTopForWires(page, wireCount);
    return {
        x: canvas.x + circuitMetrics.firstColumnLeft + col * circuitMetrics.columnSpacing + circuitMetrics.gateSize / 2,
        y: canvas.y + top + row * circuitMetrics.wireSpacing + circuitMetrics.wireSpacing / 2,
    };
}

async function waitForStatus(page, text) {
    await page.waitForFunction(
        expected => document.getElementById('circuit-cursor-status')?.textContent === expected,
        {timeout: TEST_TIMEOUT_MILLIS}, text);
}

const pause = millis => new Promise(resolve => setTimeout(resolve, millis));

test('the circuit is named and described for assistive technology, and edited by keyboard alone', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        const described = await page.$eval('#canvasDiv', element => ({
            role: element.getAttribute('role'),
            label: element.getAttribute('aria-label'),
            describedBy: element.getAttribute('aria-describedby'),
            summary: document.getElementById('circuit-summary').textContent,
            live: document.getElementById('circuit-cursor-status').getAttribute('role'),
        }));
        assert.deepEqual(described, {role: 'application', label: 'Circuit', describedBy: 'circuit-summary circuit-keys',
            summary: '2 wires, 1 column, 1 gate.', live: 'status'});

        // The arrow keys move a cell cursor, and the live line names each cell.
        await page.focus('#canvasDiv');
        await page.keyboard.press('Home');
        await waitForStatus(page, 'Wire 1, column 1: Hadamard Gate');
        assert.ok(await page.$('.circuit-cursor'), 'The cursor must be drawn on its cell.');
        await page.keyboard.press('ArrowRight');
        await waitForStatus(page, 'Wire 1, column 2: empty');

        // A gate chosen in the palette with Return lands in the cursor's cell.
        await page.focus('.gate-tile[data-gate-id="X"]');
        await page.keyboard.press('Enter');
        await waitForCircuit(page, {cols: [['H'], ['X']]});
        await waitForStatus(page, 'Wire 1, column 2: Pauli X Gate');

        // With nothing selected, Delete removes the gate in the cell.
        await page.focus('#canvasDiv');
        await page.keyboard.press('ArrowLeft');
        await waitForStatus(page, 'Wire 1, column 1: Hadamard Gate');
        await page.keyboard.press('Delete');
        await waitForCircuit(page, {cols: [['X']]});

        // Return on a gate a click does nothing for opens its menu, and closing it hands the focus back.
        await waitForStatus(page, 'Wire 1, column 1: Pauli X Gate');
        await page.keyboard.press('Enter');
        await page.waitForSelector('.gate-menu', {timeout: TEST_TIMEOUT_MILLIS});
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('.gate-menu') === null &&
            document.activeElement?.id === 'canvasDiv', {timeout: TEST_TIMEOUT_MILLIS});

        // Shift with the arrows selects, and the selection's bar switches its gates off.
        await page.keyboard.down('Shift');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.up('Shift');
        await page.waitForSelector('.selection-bar', {timeout: TEST_TIMEOUT_MILLIS});
        await page.click('.selection-bar [data-action="deactivate"]');
        await waitForCircuit(page, {cols: [[{id: 'X', off: true}]]});
        await page.waitForSelector('.selection-bar [data-action="activate"]', {timeout: TEST_TIMEOUT_MILLIS});
    });
});

test('an empty circuit says how to put the first gate on it', async browser => {
    await withQuirkPage(browser, {cols: []}, async page => {
        const hint = await page.waitForSelector('.circuit-empty-hint', {timeout: TEST_TIMEOUT_MILLIS});
        assert.match(await hint.evaluate(e => e.textContent), /Drag a gate from Gates onto a wire/);
        assert.equal(await hint.evaluate(e => getComputedStyle(e).pointerEvents), 'none');
        await page.focus('.gate-tile[data-gate-id="H"]');
        await page.keyboard.press('Enter');
        await waitForCircuit(page, {cols: [['H']]});
        await page.waitForFunction(() => document.querySelector('.circuit-empty-hint') === null, {timeout: TEST_TIMEOUT_MILLIS});
    });
});

test('Option held at the drop copies a dragged gate; let go before the drop, it moves', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        const from = await cellCentre(page, 2, 0, 0);
        const to = await cellCentre(page, 2, 1, 0);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, {steps: 5});
        await page.keyboard.down('Alt');
        await page.mouse.move(to.x, to.y + 1);
        await page.mouse.up();
        await page.keyboard.up('Alt');
        await waitForCircuit(page, {cols: [['H'], ['H']]});

        // Pressed on the way and let go again before the drop, it moves.
        const second = await cellCentre(page, 2, 1, 0);
        const below = await cellCentre(page, 2, 1, 1);
        await page.mouse.move(second.x, second.y);
        await page.mouse.down();
        await page.keyboard.down('Alt');
        await page.mouse.move(below.x, below.y, {steps: 5});
        await page.keyboard.up('Alt');
        await page.mouse.move(below.x, below.y + 1);
        await page.mouse.up();
        await waitForCircuit(page, {cols: [['H'], [1, 'H']]});
    });
});

test('a touch held still on a gate opens its menu and leaves the gate where it was', async browser => {
    await withQuirkPage(browser, {cols: [['X']]}, async page => {
        const gate = await cellCentre(page, 2, 0, 0);
        await page.touchscreen.touchStart(gate.x, gate.y);
        await pause(800);
        await page.touchscreen.touchEnd();
        await page.waitForSelector('.gate-menu [data-action="deactivate"]', {timeout: TEST_TIMEOUT_MILLIS});
        await page.click('.gate-menu [data-action="deactivate"]');
        await waitForCircuit(page, {cols: [[{id: 'X', off: true}]]});
    }, {width: 1280, height: 720, deviceScaleFactor: 1, hasTouch: true});
});

test('Reduce Motion stands the time-dependent gates still', async browser => {
    const frames = page => page.evaluate(async () => {
        const grab = () => {
            const canvas = document.querySelector('#drawCanvas canvas');
            const copy = document.createElement('canvas');
            copy.width = canvas.width;
            copy.height = canvas.height;
            copy.getContext('2d').drawImage(canvas, 0, 0);
            return copy.toDataURL();
        };
        const first = grab();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return first === grab();
    });
    await withQuirkPage(browser, {cols: [['X^t']]}, async page => {
        await waitForCanvasViewport(page);
        assert.equal(await frames(page), false, 'Without Reduce Motion the gate animates.');

        await page.emulateMediaFeatures([
            {name: 'prefers-color-scheme', value: 'dark'},
            {name: 'prefers-reduced-motion', value: 'reduce'},
        ]);
        await pause(300);
        assert.equal(await frames(page), true, 'With Reduce Motion the gate stands still.');
    });
});

test('opening the bare page continues from the circuit that was left', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['X']]}, async page => {
        await page.goto(new URL('/', page.url()).href);
        await waitForQuirk(page);
        await waitForCircuit(page, {cols: [['H'], ['X']]});
    });
});
