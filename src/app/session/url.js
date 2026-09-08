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
import {fromJsonText_CircuitDefinition, Serializer} from "../../serialization/Serializer.js"

function urlWithCircuitHash(jsonText) {
    if (jsonText.includes('%') || jsonText.includes('&')) {
        jsonText = encodeURIComponent(jsonText);
    }
    return "#" + AppInfo.URL_CIRCUIT_PARAM_KEY + "=" + jsonText;
}

/**
 * @param {!Revision} revision
 */
function initUrlCircuitSync(revision) {
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
        try {
            historyPusher.currentStateIsMemorableButUnknown();
            const params = getHashParameters();
            if (!params.has(AppInfo.URL_CIRCUIT_PARAM_KEY)) {
                const def = JSON.stringify(Serializer.toJson(CircuitDefinition.EMPTY));
                params.set(AppInfo.URL_CIRCUIT_PARAM_KEY, def);
            }

            const jsonText = params.get(AppInfo.URL_CIRCUIT_PARAM_KEY);
            historyPusher.currentStateIsMemorableAndEqualTo(jsonText);
            const circuitDef = fromJsonText_CircuitDefinition(jsonText);
            const cleanedJson = JSON.stringify(Serializer.toJson(circuitDef));
            revision.clear(cleanedJson);
            if (circuitDef.isEmpty() && params.size === 1) {
                historyPusher.currentStateIsNotMemorable();
            } else {
                const urlHash = urlWithCircuitHash(jsonText);
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

    revision.latestActiveCommit().whenDifferent().skip(1).subscribe(jsonText => {
        historyPusher.stateChange(jsonText, urlWithCircuitHash(jsonText));
    });
}

export {initUrlCircuitSync}
