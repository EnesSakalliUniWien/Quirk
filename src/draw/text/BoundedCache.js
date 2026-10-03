/**
 * A cache that forgets its oldest entry rather than grow past a limit. The text caches are keyed by
 * what a frame draws, and an animated readout draws a new string almost every frame, so a cache
 * that never forgot would grow for as long as the circuit ran.
 */
export class BoundedCache {
    /** @param {!int} limit How many entries to keep. */
    constructor(limit) {
        this.limit = limit;
        /** @type {!Map} */
        this.entries = new Map();
    }

    /** @returns {*} The value stored for `key`, or undefined. */
    get(key) {
        return this.entries.get(key);
    }

    /** Stores `value`, forgetting the oldest entry if the cache is full. @returns {*} `value`. */
    set(key, value) {
        if (this.entries.size >= this.limit && !this.entries.has(key)) {
            this.entries.delete(this.entries.keys().next().value);
        }
        this.entries.set(key, value);
        return value;
    }

    clear() {
        this.entries.clear();
    }

    /** @returns {!int} */
    get size() {
        return this.entries.size;
    }
}
