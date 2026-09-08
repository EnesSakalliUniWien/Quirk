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

import {EXAMPLE_CIRCUITS} from "./exampleCircuits.js"

/**
 * Interface note: also requires the welcome panel's #close-menu-button and #example-* anchors,
 * shipped in quirk.html's dialog stash and mounted by src/components/dialogs/menu-dialog.jsx before
 * this runs.
 *
 * @param {!Revision} revision
 * @param {!OverlayState} overlayState
 */
function initMenu(revision, overlayState) {
    // Opening the menu belongs to the sidebar's menu button (src/components/toolbox/gate-toolbox.jsx),
    // which reads the app store. Closing it is this panel's own button. Visibility, Escape,
    // backdrop clicks, and focus belong to the Base UI Dialog that wraps it.
    const closeMenuButton = /** @type {!HTMLButtonElement} */ document.getElementById('close-menu-button');
    closeMenuButton.addEventListener('click', () => overlayState.close());

    for (const {anchorId, circuit} of EXAMPLE_CIRCUITS) {
        const a = /** @type {!HTMLAnchorElement} */ document.getElementById(anchorId);
        const text = JSON.stringify(circuit);
        a.href = "#circuit=" + text;
        a.onclick = ev => {
            // Let the browser handle modified and non-left clicks, so opening the link in a new tab still works.
            if (ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey || ev.button !== 0) {
                return undefined;
            }

            revision.commit(text);
            overlayState.close();
            return false;
        };
    }
}

export {initMenu}
