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

import {Suite, assertThat, assertTrue, assertFalse} from "../TestUtil.js"
import {isPrimaryPress, watchPointerDrags, trackPointerUntilRelease} from "../../src/browser/PointerDrag.js"

const suite = new Suite("PointerDrag");

function pointer(type, overrides = {}) {
    return new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        button: 0, buttons: 1, clientX: 10, clientY: 20, ...overrides});
}

suite.test("isPrimaryPress accepts the left mouse button and any primary touch", () => {
    assertTrue(isPrimaryPress(pointer('pointerdown')));
    assertFalse(isPrimaryPress(pointer('pointerdown', {button: 1})));
    assertFalse(isPrimaryPress(pointer('pointerdown', {button: 2})));
    assertTrue(isPrimaryPress(pointer('pointerdown', {pointerType: 'touch', button: 0})));
    assertFalse(isPrimaryPress(pointer('pointerdown', {pointerType: 'touch', isPrimary: false})));
});

suite.test("watchPointerDrags reports grab, drag and drop for one pointer", () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const log = [];
    const dispose = watchPointerDrags(element, {
        onGrab: pt => log.push(['grab', pt.x, pt.y]),
        onDrag: pt => log.push(['drag', pt === undefined ? undefined : pt.x]),
        onDrop: pt => log.push(['drop', pt === undefined ? undefined : pt.x]),
        onCancel: () => log.push(['cancel']),
    });
    try {
        element.dispatchEvent(pointer('pointerdown', {button: 2}));
        element.dispatchEvent(pointer('pointerdown'));
        element.dispatchEvent(pointer('pointerdown', {pointerId: 2}));  // Ignored: a drag is in progress.
        element.dispatchEvent(pointer('pointermove', {clientX: 15}));
        element.dispatchEvent(pointer('pointermove', {pointerId: 2, clientX: 99}));
        element.dispatchEvent(pointer('pointerup', {clientX: 30, buttons: 0}));
        element.dispatchEvent(pointer('pointermove', {clientX: 40}));  // Nothing grabbed any more.
        const b = element.getBoundingClientRect();
        assertThat(log).isEqualTo([
            ['grab', 10 - b.left, 20 - b.top],
            ['drag', 15 - b.left],
            ['drop', 30 - b.left],
        ]);
    } finally {
        dispose();
        element.remove();
    }
});

suite.test("watchPointerDrags treats a released button and a cancel as the end of the gesture", () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const log = [];
    const dispose = watchPointerDrags(element, {
        onGrab: () => log.push('grab'),
        onDrag: () => log.push('drag'),
        onDrop: pt => log.push(pt === undefined ? 'lost' : 'drop'),
        onCancel: () => log.push('cancel'),
    });
    try {
        element.dispatchEvent(pointer('pointerdown'));
        element.dispatchEvent(pointer('pointermove', {buttons: 0}));
        element.dispatchEvent(pointer('pointerdown', {pointerType: 'touch'}));
        element.dispatchEvent(pointer('pointercancel', {pointerType: 'touch'}));
        assertThat(log).isEqualTo(['grab', 'lost', 'grab', 'cancel']);
    } finally {
        dispose();
        element.remove();
    }
});

suite.test("trackPointerUntilRelease follows only its pointer and stops on release", () => {
    const log = [];
    const start = pointer('pointerdown', {pointerId: 7});
    const stop = trackPointerUntilRelease(start, {
        onMove: ev => log.push(['move', ev.clientX]),
        onRelease: ev => log.push(['release', ev.clientX]),
        onCancel: () => log.push(['cancel']),
    });
    try {
        document.dispatchEvent(pointer('pointermove', {pointerId: 7, clientX: 11}));
        document.dispatchEvent(pointer('pointermove', {pointerId: 8, clientX: 12}));
        document.dispatchEvent(pointer('pointerup', {pointerId: 7, clientX: 13, buttons: 0}));
        document.dispatchEvent(pointer('pointermove', {pointerId: 7, clientX: 14}));
        assertThat(log).isEqualTo([['move', 11], ['release', 13]]);
    } finally {
        stop();
    }
});
