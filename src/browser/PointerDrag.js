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

import {Point} from "../geometry/Point.js"

/**
 * @param {!MouseEvent|!PointerEvent|!Touch} ev Anything with clientX and clientY.
 * @param {!HTMLElement} element
 * @returns {!Point}
 */
function eventPosRelativeTo(ev, element) {
    const b = element.getBoundingClientRect();
    return new Point(ev.clientX - b.left, ev.clientY - b.top);
}

/**
 * Whether the pointer event is one a drag may start from: the primary pointer, and for a mouse
 * the left button.
 * @param {!PointerEvent} ev
 * @returns {!boolean}
 */
function isPrimaryPress(ev) {
    return ev.isPrimary && (ev.pointerType !== 'mouse' || ev.button === 0);
}

/**
 * Follows one pointer, already pressed, until it is released or lost. For drags that start on an
 * element that may be covered mid-gesture (a palette tab that gives way to the circuit when a gate
 * is taken), so the listeners sit on the document rather than on the element.
 *
 * @param {!PointerEvent} startEvent The press the gesture began with.
 * @param {!{
 *     onMove: !function(!PointerEvent): void,
 *     onRelease: !function(!PointerEvent): void,
 *     onCancel: !function(!PointerEvent): void
 * }} handlers
 * @returns {!function(): void} Stops following the pointer without firing any handler.
 */
function trackPointerUntilRelease(startEvent, handlers) {
    const id = startEvent.pointerId;
    let stopped = false;
    const stop = () => {
        if (stopped) {
            return;
        }
        stopped = true;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onCancel);
    };
    const onMove = ev => {
        if (ev.pointerId !== id) {
            return;
        }
        if (ev.pointerType === 'mouse' && (ev.buttons & 1) === 0) {
            stop();
            handlers.onRelease(ev);
            return;
        }
        handlers.onMove(ev);
    };
    const onUp = ev => {
        if (ev.pointerId !== id) {
            return;
        }
        stop();
        handlers.onRelease(ev);
    };
    const onCancel = ev => {
        if (ev.pointerId !== id) {
            return;
        }
        stop();
        handlers.onCancel(ev);
    };
    document.addEventListener('pointermove', onMove, {passive: false});
    document.addEventListener('pointerup', onUp, {passive: false});
    document.addEventListener('pointercancel', onCancel);
    return stop;
}

export {eventPosRelativeTo, isPrimaryPress, trackPointerUntilRelease}
