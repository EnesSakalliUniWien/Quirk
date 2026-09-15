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

import {columnStructure} from '../../engine/simulation/columnStructure.js';
import { fromJsonText_CircuitDefinition } from "../../serialization/circuits/text.js";
import {rasterOperatorTile} from './rasters.js';

/**
 * Draws tiles of a column's operator off the page's thread; src/draw/renderers/operatorTiles.js
 * asks for them. The worker rebuilds the circuit from its JSON - the same gate catalogue the page
 * loads, minus the GPU - and keeps the last circuit's column structures, since a view asks for
 * many tiles of one step.
 *
 * Requests are served newest first: the newest is what the view shows now. A request the view no
 * longer needs is cancelled before it is drawn.
 */

let circuitJson = undefined;
let circuit = undefined;
const structures = new Map();
const queue = [];
let scheduled = false;

/**
 * @param {!{json: !string, col: !int, wireCount: !int, time: !number}} request
 * @returns {!ColumnStructure|!{ok: false, reason: !string}}
 */
function structureFor({json, col, wireCount, time}) {
    if (json !== circuitJson) {
        circuitJson = json;
        circuit = fromJsonText_CircuitDefinition(json);
        structures.clear();
    }
    const key = `${col}:${wireCount}:${time}`;
    if (!structures.has(key)) {
        structures.set(key, columnStructure(circuit, col, wireCount, time));
    }
    return structures.get(key);
}

function drawNext() {
    scheduled = false;
    const request = queue.pop();
    if (request === undefined) {
        return;
    }
    try {
        const structure = structureFor(request);
        if (structure.ok) {
            const pixels = rasterOperatorTile(structure, request.level, request.x, request.y);
            self.postMessage({id: request.id, pixels}, [pixels.buffer]);
        } else {
            self.postMessage({id: request.id, error: structure.reason});
        }
    } catch (error) {
        self.postMessage({id: request.id, error: String(error?.message ?? error)});
    }
    schedule();
}

/** One tile per task, so a cancellation that arrives meanwhile is read before the next tile. */
function schedule() {
    if (!scheduled && queue.length > 0) {
        scheduled = true;
        setTimeout(drawNext, 0);
    }
}

self.onmessage = ({data}) => {
    if (data.type === 'cancel') {
        const index = queue.findIndex(request => request.id === data.id);
        if (index !== -1) {
            queue.splice(index, 1);
        }
        return;
    }
    queue.push(data);
    schedule();
};
