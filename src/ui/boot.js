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

import {initializedWglContext} from "../webgl/WglContext.js"

/**
 * Remembers that the welcome overlay has been shown. Without it the overlay is the app's starting
 * state on every load, which is a greeting the first time and an obstacle every time after.
 * @type {!string}
 */
const SEEN_WELCOME_STORAGE_KEY = 'shadow-quant.seen-welcome';

/**
 * @param {!Storage} storage
 * @returns {!boolean}
 */
function hasSeenWelcome(storage) {
    // Private windows and blocked site data throw rather than returning null, and a browser that
    // can't remember should still get the welcome rather than an error.
    try {
        return storage.getItem(SEEN_WELCOME_STORAGE_KEY) === 'true';
    } catch (ex) {
        return false;
    }
}

/**
 * @param {!Storage} storage
 * @returns {void}
 */
function noteWelcomeSeen(storage) {
    try {
        storage.setItem(SEEN_WELCOME_STORAGE_KEY, 'true');
    } catch (ex) {
        // Nothing to do: the welcome simply shows again next time.
    }
}

/**
 * Whether this load should greet the user with the welcome overlay, remembering a yes so the next
 * load doesn't repeat it. A load that already carries a circuit skips the greeting outright.
 *
 * @param {!boolean} circuitIsEmpty
 * @param {!Storage} storage
 * @returns {!boolean}
 */
function shouldShowWelcome(circuitIsEmpty, storage) {
    if (!circuitIsEmpty || hasSeenWelcome(storage)) {
        return false;
    }
    noteWelcomeSeen(storage);
    return true;
}

/**
 * Schedules the app's reveal: unhide the page, paint the first frame, swap the loading notice for
 * the welcome's action button, and settle whether the welcome overlay stays up. Deferred a tick so
 * that a WebGL initialization failure surfaces as a runtime error rather than killing the module
 * loading phase.
 *
 * Interface note: also requires #inspectorDiv and #canvasDiv (html/quirk.template.html) and the
 * welcome panel's #loading-div and #close-menu-button (html/menu.partial.html, mounted by
 * src/components/menu-dialog.jsx) to exist before the scheduled tick runs.
 *
 * @param {!ObservableValue.<!DisplayedInspector>} displayed
 * @param {!OverlayState} overlayState
 * @param {!{start: !function(): void, trigger: !function(): void}} redrawLoop
 * @param {!Storage=} storage Where the welcome-seen flag lives.
 * @returns {void}
 */
function scheduleBoot(displayed, overlayState, redrawLoop, storage = window.localStorage) {
    setTimeout(() => {
        // Clearing the inline 'none' hands display back to the stylesheet, which lays the app out
        // as a column.
        document.getElementById("inspectorDiv").style.display = '';
        redrawLoop.start();
        document.getElementById("loading-div").style.display = 'none';
        document.getElementById("close-menu-button").style.display = 'block';
        let circuitIsEmpty = displayed.get().displayedCircuit.circuitDefinition.isEmpty();
        if (!shouldShowWelcome(circuitIsEmpty, storage)) {
            overlayState.close();
        }

        try {
            initializedWglContext().onContextRestored = () => redrawLoop.trigger();
        } catch (ex) {
            // If that failed, the user is already getting warnings about WebGL not being supported.
            // Just silently log it.
            console.error(ex);
        }
    }, 0);
}

export {scheduleBoot, shouldShowWelcome, SEEN_WELCOME_STORAGE_KEY}
