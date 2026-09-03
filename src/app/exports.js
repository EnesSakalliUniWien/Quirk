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

import {AppInfo} from "../config/AppInfo.js"
import {selectAndCopyToClipboard} from "../browser/Clipboard.js"

/**
 * Interface note: also requires #export-button (src/components/app-toolbar.jsx) and the export
 * panel's #export-* elements, shipped in quirk.html's dialog stash and mounted by
 * src/components/export-dialog.jsx before this runs.
 *
 * @param {!Revision} revision
 * @param {!ObservableValue.<!CircuitStats>} mostRecentStats
 * @param {!OverlayState} overlayState
 */
function initExports(revision, mostRecentStats, overlayState) {
    const obsActiveOverlay = overlayState.active();
    const obsIsAnyOverlayShowing = obsActiveOverlay.map(active => active !== undefined).whenDifferent();

    // Open the exports overlay. Visibility, Escape, backdrop clicks, and focus belong to the
    // Base UI Dialog that wraps it (src/components/app-dialogs.jsx).
    (() => {
        const exportButton = /** @type {!HTMLButtonElement} */ document.getElementById('export-button');
        exportButton.addEventListener('click', () => overlayState.open("export"));
        obsIsAnyOverlayShowing.subscribe(e => { exportButton.disabled = e; });
    })();

    /**
     * @param {!HTMLButtonElement} button
     * @param {!HTMLElement} contentElement
     * @param {!HTMLElement} resultElement
     * @param {undefined|!function(): !string} contentMaker
     */
    const setupButtonElementCopyToClipboard = (button, contentElement, resultElement, contentMaker=undefined) =>
        button.addEventListener('click', () => {
            if (contentMaker !== undefined) {
                contentElement.innerText = contentMaker();
            }

            //noinspection UnusedCatchParameterJS,EmptyCatchBlockJS
            try {
                selectAndCopyToClipboard(contentElement);
                resultElement.innerText = "Done!";
            } catch (ex) {
                resultElement.innerText = "It didn't work...";
                console.warn('Clipboard copy failed.', ex);
            }
            button.disabled = true;
            setTimeout(() => {
                resultElement.innerText = "";
                button.disabled = false;
            }, 1000);
        });

    // Export escaped link.
    (() => {
        const linkElement = /** @type {HTMLAnchorElement} */ document.getElementById('export-escaped-anchor');
        const copyButton = /** @type {HTMLButtonElement} */ document.getElementById('export-link-copy-button');
        const copyResultElement = /** @type {HTMLElement} */ document.getElementById('export-link-copy-result');
        setupButtonElementCopyToClipboard(copyButton, linkElement, copyResultElement);
        revision.latestActiveCommit().subscribe(jsonText => {
            let escapedUrlHash = "#" + AppInfo.URL_CIRCUIT_PARAM_KEY + "=" + encodeURIComponent(jsonText);
            linkElement.href = escapedUrlHash;
            linkElement.innerText = document.location.href.split("#")[0] + escapedUrlHash;
        });
    })();

    // Export JSON.
    (() => {
        const jsonTextElement = /** @type {HTMLPreElement} */ document.getElementById('export-circuit-json-pre');
        const copyButton = /** @type {HTMLButtonElement} */ document.getElementById('export-json-copy-button');
        const copyResultElement = /** @type {HTMLElement} */ document.getElementById('export-json-copy-result');
        setupButtonElementCopyToClipboard(copyButton, jsonTextElement, copyResultElement);
        revision.latestActiveCommit().subscribe(jsonText => {
            //noinspection UnusedCatchParameterJS
            try {
                let val = JSON.parse(jsonText);
                jsonTextElement.innerText = JSON.stringify(val, null, '  ');
            } catch (_) {
                jsonTextElement.innerText = jsonText;
            }
        });
    })();

    // Export final output.
    (() => {
        const outputTextElement = /** @type {HTMLPreElement} */ document.getElementById('export-amplitudes-pre');
        const copyButton = /** @type {HTMLButtonElement} */ document.getElementById('export-amplitudes-button');
        const copyResultElement = /** @type {HTMLElement} */ document.getElementById('export-amplitudes-result');
        const excludeAmps = /** @type {HTMLInputElement} */ document.getElementById('export-amplitudes-use-amps');
        obsIsAnyOverlayShowing.subscribe(_ => {
            outputTextElement.innerText = '[not generated yet]';
        });
        setupButtonElementCopyToClipboard(
            copyButton,
            outputTextElement,
            copyResultElement,
            () => {
                let raw = JSON.stringify(mostRecentStats.get().toReadableJson(!excludeAmps.checked), null, ' ');
                return raw.replace(/{\s*"r": /g, '{"r":').replace(/,\s*"i":\s*([-e\d\.]+)\s*}/g, ',"i":$1}');
            });
    })();
}

export {initExports}
