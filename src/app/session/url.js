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

import {reportRecoveredError} from "../../diagnostics/errorReporter.js"
import {CircuitDefinition} from "../../circuit/model/CircuitDefinition.js"
import {AppInfo} from "../../config/AppInfo.js"
import {HistoryPusher} from "../../browser/HistoryPusher.js"
import { Serializer } from "../../serialization/Serializer.js";
import { fromJsonText_CircuitDefinition } from "../../serialization/circuits/text.js";
import { LINK_LIMIT } from "../../results/files/limits.js";

/**
 * @param {!string} jsonText
 * @param {!Array.<!int>} breakpoints The columns with a breakpoint; they follow the circuit in the
 *     link, and are left out when there are none.
 * @returns {!string}
 */
function urlWithCircuitHash(jsonText, breakpoints = []) {
    if (jsonText.includes('%') || jsonText.includes('&')) {
        jsonText = encodeURIComponent(jsonText);
    }
    const breakpointHash = breakpoints.length === 0 ? "" :
        `&${AppInfo.URL_BREAKPOINTS_PARAM_KEY}=${breakpoints.join(",")}`;
    return `#${AppInfo.URL_CIRCUIT_PARAM_KEY}=${jsonText}${breakpointHash}`;
}

/**
 * @param {undefined|!string} text
 * @returns {!Array.<!int>} The columns a link names; whatever is no column is skipped, and the
 *     playhead keeps only those with an operation.
 */
function parseBreakpoints(text) {
    return (text ?? "").split(",").
        filter(part => /^\d+$/.test(part.trim())).
        map(part => parseInt(part.trim(), 10));
}

/** Where the last circuit shown is remembered, for a visit whose address names none. */
const LAST_CIRCUIT_STORAGE_KEY = "shadow-quant.last-circuit";

/**
 * @returns {undefined|!string} The circuit the last visit left, if the browser kept it and this
 *     version still reads it; one it cannot read is quietly passed over for an empty circuit.
 */
function readLastCircuit() {
    try {
        const text = window.localStorage.getItem(LAST_CIRCUIT_STORAGE_KEY) ?? undefined;
        if (text !== undefined) {
            fromJsonText_CircuitDefinition(text);
        }
        return text;
    } catch {
        return undefined;
    }
}

/** @param {!string} jsonText */
function writeLastCircuit(jsonText) {
    try {
        window.localStorage.setItem(LAST_CIRCUIT_STORAGE_KEY, jsonText);
    } catch {
        // A browser that refuses site data starts the next visit empty, as a bare address always did.
    }
}

/**
 * The address is the circuit: each edit writes it into the link, and going back through the
 * browser's history goes back through the edits. The circuit is also remembered in the browser, so
 * opening the app without a circuit in its address - from a bookmark of the bare page, or by typing
 * it - continues from the circuit that was left, as an app restarted comes back to where it was.
 *
 * @param {!Revision} revision
 * @param {!Recorder} recorder
 * @param {!Playhead} playhead Holds the breakpoints, which the link carries beside the circuit.
 * @param {undefined|!function(): void} onTakeLoaded Called after the current URL take is restored.
 */
function initUrlCircuitSync(revision, recorder, playhead, onTakeLoaded) {
    let loadingTake = false;
    let loadVersion = 0;
    // Pull initial circuit out of URL '#x=y' arguments.
    const getHashParameters = () => {
        const hashText = document.location.hash.slice(1);
        const paramsMap = new Map();
        if (hashText !== "") {
            for (const keyVal of hashText.split("&")) {
                const eq = keyVal.indexOf("=");
                if (eq === -1) {
                    continue;
                }
                const key = keyVal.slice(0, Math.max(0, eq));
                const val = decodeURIComponent(keyVal.slice(Math.max(0, eq + 1)));
                paramsMap.set(key, val);
            }
        }
        return paramsMap;
    };

    const historyPusher = new HistoryPusher();
    const loadCircuitFromUrl = () => {
        const version = ++loadVersion;
        try {
            historyPusher.currentStateIsMemorableButUnknown();
            const params = getHashParameters();
            if (params.has("take") && recorder !== undefined) {
                if (new TextEncoder().encode(document.location.hash).byteLength > LINK_LIMIT) throw new Error("Take link exceeds 32 KiB");
                if (JSON.parse(params.get("take")).format !== "shadow-quant-take/1") throw new Error("A take link must contain one take");
                // The take is shown and restored, not saved: opening a link records nothing until the
                // user keeps it.
                loadingTake = true;
                try {
                    recorder.openLink(params.get("take"));
                } catch (error) {
                    recorder.store.error.setState({value: error.message});
                    return;
                } finally {
                    loadingTake = false;
                }
                onTakeLoaded?.();
                return;
            }
            // An address without a take leaves the take a link brought, if it was not kept.
            recorder?.closeLink();
            // Opened without a circuit: the one the last visit left, or else an empty one. A circuit
            // taken back up is written into the address, so the page's link is the circuit's again.
            const restored = !params.has(AppInfo.URL_CIRCUIT_PARAM_KEY) && version === 1 ? readLastCircuit() : undefined;
            if (!params.has(AppInfo.URL_CIRCUIT_PARAM_KEY)) {
                params.set(AppInfo.URL_CIRCUIT_PARAM_KEY,
                    restored ?? JSON.stringify(Serializer.toJson(CircuitDefinition.EMPTY)));
            }

            const jsonText = params.get(AppInfo.URL_CIRCUIT_PARAM_KEY);
            historyPusher.currentStateIsMemorableAndEqualTo(jsonText);
            const circuitDef = fromJsonText_CircuitDefinition(jsonText);
            const cleanedJson = JSON.stringify(Serializer.toJson(circuitDef));
            revision.clear(cleanedJson);
            playhead.setBreakpoints(parseBreakpoints(params.get(AppInfo.URL_BREAKPOINTS_PARAM_KEY)));
            if (restored !== undefined && !circuitDef.isEmpty()) {
                historyPusher.replaceHash(urlWithCircuitHash(jsonText, playhead.breakpoints()));
            } else if (circuitDef.isEmpty() && params.size === 1) {
                historyPusher.currentStateIsNotMemorable();
            } else {
                const urlHash = urlWithCircuitHash(jsonText, playhead.breakpoints());
                historyPusher.stateChange(jsonText, urlHash);
            }
        } catch (ex) {
            reportRecoveredError(
                "Defaulted to an empty circuit. Failed to understand circuit from URL.",
                {document_location_hash: document.location.hash},
                ex);
        }
    };

    window.addEventListener('popstate', loadCircuitFromUrl);
    loadCircuitFromUrl();

    revision.latestActiveCommit().whenDifferent().subscribe(writeLastCircuit);

    revision.latestActiveCommit().whenDifferent().skip(1).subscribe(jsonText => {
        if (!loadingTake) historyPusher.stateChange(jsonText, urlWithCircuitHash(jsonText, playhead.breakpoints()));
    });
    // Breakpoints are no step in the history: they rewrite the current entry's link, the way a
    // debugger keeps them beside the source rather than in it.
    playhead.state().map(state => state.breakpoints.join(",")).whenDifferent().skip(1).subscribe(() => {
        if (!loadingTake && !document.location.hash.includes("take=")) {
            historyPusher.replaceHash(urlWithCircuitHash(revision.peekActiveCommit(), playhead.breakpoints()));
        }
    });
}

export {initUrlCircuitSync, urlWithCircuitHash, parseBreakpoints}
