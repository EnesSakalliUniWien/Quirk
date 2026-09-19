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

// The gate menu a right click opens, and the dial beside a rotation gate's angle.

import assert from 'node:assert/strict';
import {
    test, withQuirkPage, waitForCircuit, waitForPanel, waitForCanvasViewport, circuitTopForWires, circuitMetrics,
    TEST_TIMEOUT_MILLIS,
} from './harness.js';

/** The centre of the gate in the first column on the first wire, in page coordinates. */
async function firstGateCentre(page, wireCount) {
    await waitForCanvasViewport(page);
    const canvas = await page.$eval('#drawCanvas canvas', element => {
        const bounds = element.getBoundingClientRect();
        return {x: bounds.x, y: bounds.y};
    });
    const top = await circuitTopForWires(page, wireCount);
    return {
        x: canvas.x + circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2,
        y: canvas.y + top + circuitMetrics.wireSpacing / 2,
    };
}

async function chooseFromGateMenu(page, action) {
    const item = await page.waitForSelector(`.gate-menu [data-action="${action}"]`, {timeout: TEST_TIMEOUT_MILLIS});
    await item.click();
}

test('a right click on a gate switches it off and on, and deletes it, through its menu', async browser => {
    await withQuirkPage(browser, {cols: [['X']]}, async page => {
        const gate = await firstGateCentre(page, 2);
        await page.mouse.click(gate.x, gate.y, {button: 'right'});
        const label = await page.waitForSelector('.gate-menu .app-menu-label', {timeout: TEST_TIMEOUT_MILLIS});
        assert.equal(await label.evaluate(e => e.textContent), 'Pauli X Gate');
        // A gate without a parameter offers no parameter item.
        assert.equal(await page.$('.gate-menu [data-action="edit"]'), null);
        await chooseFromGateMenu(page, 'deactivate');
        await waitForCircuit(page, {cols: [[{id: 'X', off: true}]]});
        await page.waitForFunction(() => document.querySelector('.gate-menu') === null, {timeout: TEST_TIMEOUT_MILLIS});

        // Off, the gate keeps its slot; the menu now offers to switch it back on.
        await page.mouse.click(gate.x, gate.y, {button: 'right'});
        await chooseFromGateMenu(page, 'activate');
        await waitForCircuit(page, {cols: [['X']]});

        // Each edit is one commit.
        await page.click('#undo-button');
        await waitForCircuit(page, {cols: [[{id: 'X', off: true}]]});
        await page.click('#redo-button');
        await waitForCircuit(page, {cols: [['X']]});

        await page.mouse.click(gate.x, gate.y, {button: 'right'});
        await chooseFromGateMenu(page, 'delete');
        await waitForCircuit(page, {cols: []});
    });
});

test('a rotation gate wears a dial on its wire, and each turn of it is one commit', async browser => {
    await withQuirkPage(browser, {cols: [[{id: 'Rx', arg: 'pi/2'}]]}, async page => {
        // The dial is there from the start, in the column past the gate's box, on its wire.
        await page.waitForSelector('#wire-dial-0-0', {visible: true, timeout: TEST_TIMEOUT_MILLIS});
        const gate = await firstGateCentre(page, 2);
        const dial = await page.$eval('#wire-dial-0-0', e => e.getBoundingClientRect().toJSON());
        assert.ok(Math.abs(dial.left - (gate.x + 2 * circuitMetrics.columnSpacing - circuitMetrics.gateSize / 2)) < 2,
            `The dial must sit two columns past the gate's centre: ${dial.left}`);
        assert.ok(Math.abs(dial.top + dial.height / 2 - gate.y) < 2, 'The dial must sit on the wire.');
        const angle = () => page.$eval('#wire-dial-0-0', e => Number(e.getAttribute('aria-valuenow')));
        assert.equal(await angle(), 90);

        // The arrow keys turn by a degree, shift by a detent; the gate takes the exact angle.
        await page.focus('#wire-dial-0-0');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        assert.equal(await angle(), 92);
        await waitForCircuit(page, {cols: [[{id: 'Rx', arg: '23pi/45'}]]});
        await page.keyboard.down('Shift');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.up('Shift');
        await waitForCircuit(page, {cols: [[{id: 'Rx', arg: '7pi/12'}]]});

        // A drag round the face turns it too, clockwise up, and settles when it is let go. The box
        // keeps its width as the angle's text changes, so the dial is where it was.
        const now = await page.$eval('#wire-dial-0-0', e => e.getBoundingClientRect().toJSON());
        assert.deepEqual([now.left, now.top], [dial.left, dial.top], 'The dial must not move as it turns.');
        const centre = {x: dial.left + dial.width / 2, y: dial.top + dial.height / 2, r: dial.width / 2};
        await page.mouse.move(centre.x, centre.y - centre.r * 0.7);
        await page.mouse.down();
        await page.mouse.move(centre.x + centre.r * 0.5, centre.y - centre.r * 0.5, {steps: 4});
        await page.mouse.move(centre.x + centre.r * 0.7, centre.y, {steps: 4});
        await page.mouse.up();
        const dragged = await angle();
        assert.ok(dragged > 150 && dragged < 210, `A quarter turn clockwise must add about 90°, not land on ${dragged}`);
        await page.waitForFunction(
            () => !document.location.hash.includes(encodeURIComponent('7pi/12')), {timeout: TEST_TIMEOUT_MILLIS});

        // Each settled turn is one commit: undo takes the drag back, then the detent.
        await page.click('#undo-button');
        await waitForCircuit(page, {cols: [[{id: 'Rx', arg: '7pi/12'}]]});
        await page.click('#undo-button');
        await waitForCircuit(page, {cols: [[{id: 'Rx', arg: '23pi/45'}]]});
        assert.equal(await angle(), 92);

        // The menu still opens the panel for a typed formula, and the dial follows what is typed.
        await page.mouse.click(gate.x, gate.y, {button: 'right'});
        await chooseFromGateMenu(page, 'edit');
        await waitForPanel(page, 'gate-param', true);
        await page.waitForFunction(() => document.activeElement?.id === 'gate-param-input', {timeout: TEST_TIMEOUT_MILLIS});
        await page.keyboard.type('pi');
        await page.keyboard.press('Enter');
        await waitForCircuit(page, {cols: [[{id: 'Rx', arg: 'pi'}]]});
        assert.equal(await angle(), 180);

        // A gate dropped where the dial is lands past it: the dial's column is the gate's.
        assert.equal((await page.$$('.wire-dial')).length, 1);
    });
});
