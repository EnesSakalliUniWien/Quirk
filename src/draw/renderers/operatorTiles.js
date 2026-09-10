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

import {TILE_SIZE} from './rasters.js';

/**
 * The page's side of the operator tiles. One worker draws them for every view
 * (src/draw/renderers/operatorTiles.worker.js); the page keeps the last few hundred as
 * ImageBitmaps, so panning back over a tile, or opening the same step again, does not redraw it.
 *
 * A tile is named by its source - circuit JSON, column, wire count, time - and its place: level,
 * x and y, as in a map's tiles.
 */

/** How many drawn tiles are kept: 256 of them is 64 MB of pixels at most. */
const CACHE_LIMIT = 256;

let worker = undefined;
let nextId = 1;
let nextCircuitId = 1;
/** Requests sent to the worker, by id. */
const pending = new Map();
/** Drawn tiles by key, least recently used first. */
const tiles = new Map();
/** Tiles on their way, by key. */
const loading = new Map();
/** A short id per circuit, so a tile's key does not carry the whole circuit. */
const circuitIds = new Map();

function tileWorker() {
    if (worker === undefined) {
        worker = new Worker(new URL('./operatorTiles.worker.js', import.meta.url), {type: 'module'});
        worker.onmessage = ({data}) => {
            const waiting = pending.get(data.id);
            pending.delete(data.id);
            if (waiting === undefined) {
                return;
            }
            if (data.error !== undefined) {
                waiting.reject(new Error(data.error));
            } else {
                waiting.resolve(data.pixels);
            }
        };
        // A worker that fails to load, or throws outside a request, answers nothing more. Fail
        // every waiting tile, so its view can say so rather than stay blank, and let the next
        // tile start a fresh worker.
        worker.onerror = event => {
            const failed = [...pending.values()];
            pending.clear();
            loading.clear();
            worker.terminate();
            worker = undefined;
            const error = new Error(`the tile worker stopped (${event.message || 'it did not load'})`);
            for (const waiting of failed) {
                waiting.reject(error);
            }
        };
    }
    return worker;
}

/**
 * @param {!{json: !string, col: !int, wireCount: !int, time: !number}} source
 * @param {!int} level
 * @param {!int} x
 * @param {!int} y
 * @returns {!string}
 */
function tileKey(source, level, x, y) {
    if (!circuitIds.has(source.json)) {
        // Old circuits' tiles are simply never asked for again; the cache ages them out.
        if (circuitIds.size >= 32) {
            circuitIds.clear();
        }
        circuitIds.set(source.json, nextCircuitId++);
    }
    return `${circuitIds.get(source.json)}:${source.col}:${source.wireCount}:${source.time}:${level}/${x}/${y}`;
}

/**
 * @param {!string} key
 * @returns {undefined|!ImageBitmap} The tile, if it is drawn.
 */
function peekTile(key) {
    const bitmap = tiles.get(key);
    if (bitmap !== undefined) {
        tiles.delete(key);
        tiles.set(key, bitmap);
    }
    return bitmap;
}

/**
 * Asks for a tile. Asking again for a tile on its way waits for the same drawing.
 *
 * @param {!string} key From tileKey.
 * @param {!{json: !string, col: !int, wireCount: !int, time: !number}} source
 * @param {!int} level
 * @param {!int} x
 * @param {!int} y
 * @returns {!Promise.<!ImageBitmap>} Rejects if the tile is cancelled or cannot be drawn.
 */
function loadTile(key, source, level, x, y) {
    const drawn = peekTile(key);
    if (drawn !== undefined) {
        return Promise.resolve(drawn);
    }
    if (!loading.has(key)) {
        const id = nextId++;
        const promise = new Promise((resolve, reject) => pending.set(id, {resolve, reject})).
            then(pixels => createImageBitmap(new ImageData(pixels, TILE_SIZE, TILE_SIZE))).
            then(bitmap => {
                tiles.set(key, bitmap);
                while (tiles.size > CACHE_LIMIT) {
                    const [oldest, old] = tiles.entries().next().value;
                    tiles.delete(oldest);
                    old.close();
                }
                return bitmap;
            }).
            // Only this request's entry: a cancelled request can settle after the same tile was
            // asked for again.
            finally(() => {
                if (loading.get(key)?.id === id) {
                    loading.delete(key);
                }
            });
        loading.set(key, {id, promise});
        tileWorker().postMessage({id, json: source.json, col: source.col, wireCount: source.wireCount,
            time: source.time, level, x, y});
    }
    return loading.get(key).promise;
}

/**
 * Stops drawing a tile no view needs any more.
 *
 * @param {!string} key
 */
function cancelTile(key) {
    const request = loading.get(key);
    if (request === undefined) {
        return;
    }
    loading.delete(key);
    tileWorker().postMessage({type: 'cancel', id: request.id});
    const waiting = pending.get(request.id);
    pending.delete(request.id);
    waiting?.reject(new DOMException('The tile is no longer needed.', 'AbortError'));
}

export {TILE_SIZE, cancelTile, loadTile, peekTile, tileKey};
