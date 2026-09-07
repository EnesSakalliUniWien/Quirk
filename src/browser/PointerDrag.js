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
    let b = element.getBoundingClientRect();
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
 * Pointer capture fails for synthetic events and for pointers the browser no longer tracks; a
 * drag still works without it, just without following the pointer past the element.
 * @param {!Element} element
 * @param {!int} pointerId
 */
function tryCapture(element, pointerId) {
    try {
        element.setPointerCapture(pointerId);
    } catch (_) {
        // Nothing to do.
    }
}

/**
 * Watches an element for grab, drag and drop gestures made with a mouse, a pen or a finger, using
 * Pointer Events. One gesture at a time: presses while a drag is in progress are ignored.
 *
 * The browser decides at touch time whether a finger scrolls or is delivered as a pointer, so an
 * element that must be draggable by touch needs `touch-action: none` on it or on an overlay.
 *
 * @param {!HTMLElement} element The element presses are listened on. It receives pointer capture,
 *     so a drag keeps reporting after the pointer leaves it.
 * @param {!{
 *     onGrab: !function(!Point, !PointerEvent): void,
 *     onDrag: !function(undefined|!Point, !PointerEvent): void,
 *     onDrop: !function(undefined|!Point, !PointerEvent): void,
 *     onCancel: !function(!PointerEvent): void
 * }} handlers Positions are relative to measureElement; undefined means the pointer was lost.
 * @param {!HTMLElement=} measureElement Positions are reported relative to this element instead of
 *     the listening element. Needed when the listening element is a scroll container, whose own
 *     corner stays put while its content moves.
 * @returns {!function(): void} Removes the listeners.
 */
function watchPointerDrags(element, handlers, measureElement = element) {
    /** @type {undefined|!int} */
    let activePointerId = undefined;
    const pos = ev => eventPosRelativeTo(ev, measureElement);
    const end = () => { activePointerId = undefined; };

    const onPointerDown = ev => {
        if (activePointerId !== undefined || !isPrimaryPress(ev)) {
            return;
        }
        activePointerId = ev.pointerId;
        tryCapture(element, ev.pointerId);
        handlers.onGrab(pos(ev), ev);
    };
    const onPointerMove = ev => {
        if (ev.pointerId !== activePointerId) {
            return;
        }
        if (ev.pointerType === 'mouse' && (ev.buttons & 1) === 0) {
            // The button came up somewhere the page never heard about, e.g. over another window.
            end();
            handlers.onDrop(undefined, ev);
            return;
        }
        handlers.onDrag(pos(ev), ev);
    };
    const onPointerUp = ev => {
        if (ev.pointerId !== activePointerId) {
            return;
        }
        end();
        handlers.onDrop(pos(ev), ev);
    };
    const onPointerCancel = ev => {
        if (ev.pointerId !== activePointerId) {
            return;
        }
        end();
        handlers.onCancel(ev);
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerCancel);
    return () => {
        element.removeEventListener('pointerdown', onPointerDown);
        element.removeEventListener('pointermove', onPointerMove);
        element.removeEventListener('pointerup', onPointerUp);
        element.removeEventListener('pointercancel', onPointerCancel);
    };
}

/**
 * Follows one pointer, already pressed, until it is released or lost. For drags that start on an
 * element that may disappear mid-gesture (a drawer that closes when a gate is taken), so the
 * listeners sit on the document rather than on the element.
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

export {eventPosRelativeTo, isPrimaryPress, watchPointerDrags, trackPointerUntilRelease}
