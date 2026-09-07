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

/**
 * Copies text to the clipboard through the async Clipboard API, falling back to selecting the
 * given element and running the legacy copy command where the API is unavailable (an insecure
 * context, or a browser without it).
 *
 * @param {!string} text
 * @param {!HTMLElement=} fallbackElement An element whose contents equal the text, for the
 *     legacy path.
 * @returns {!Promise.<void>} Rejects when neither path could copy.
 */
async function copyTextToClipboard(text, fallbackElement = undefined) {
    if (navigator.clipboard !== undefined && navigator.clipboard.writeText !== undefined) {
        await navigator.clipboard.writeText(text);
        return;
    }
    if (fallbackElement === undefined) {
        throw new Error("Clipboard API unavailable and no fallback element given.");
    }
    selectAndCopyToClipboard(fallbackElement);
}

/**
 * The legacy path: select the element's contents and ask the browser to copy the selection.
 * @param {!HTMLElement} element
 * @throws
 */
function selectAndCopyToClipboard(element) {
    let range = document.createRange();
    range.selectNodeContents(element);
    let selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    if (!document.execCommand('copy')) {
        throw new Error("execCommand failed");
    }
}

export {copyTextToClipboard, selectAndCopyToClipboard}
