import {createValueStore} from '../base/valueStore.js';
import {openDB} from "idb";

import { MAX_FILE_BYTES } from "./files/limits.js";

/** One transaction owns admission, ghost eviction and a batch's writes. */
class TapeStore {
    constructor(name = "shadow-quant-tape", cap = MAX_FILE_BYTES) {
        this.cap = cap;
        this.items = createValueStore([]);
        this.error = createValueStore("");
        this.db = openDB(name, 1, {
            upgrade: db => db.createObjectStore("takes", {keyPath: "id"}),
            blocked: () => this.error.setState({value: "Close older app tabs to open Tape storage."}),
            blocking: () => this.db.then(db => db.close()),
            terminated: () => this.error.setState({value: "Tape storage closed unexpectedly. Reload to reopen it."}),
        });
        this.ready = this.refresh().catch(error => {this.error.setState({value: error.message});});
    }

    async refresh() {
        const db = await this.db;
        this.items.setState({value: (await db.getAll("takes")).sort((a,b) => a.order - b.order)});
    }

    async write(takes, {ghost = false, remove = [], signal} = {}) {
        const records = takes.map((take, i) => ({id: take.id, take, ghost, order: Date.now() + i / 1000,
            bytes: new TextEncoder().encode(JSON.stringify({id: take.id, take, ghost, order: Date.now()})).byteLength}));
        const db = await this.db;
        signal?.throwIfAborted();
        const tx = db.transaction("takes", "readwrite");
        const abort = () => {try {tx.abort();} catch { /* Already finished. */ }};
        signal?.addEventListener("abort", abort, {once: true});
        // Observe rejection immediately, including aborts caused before awaiting tx.done.
        const done = tx.done;
        done.catch(() => {});
        try {
            const existing = await tx.store.getAll();
            const merged = new Map(existing.map(r => [r.id, r]));
            remove.forEach(id => merged.delete(id));
            records.forEach(r => merged.set(r.id, {...r, order: merged.get(r.id)?.order ?? r.order}));
            let bytes = [...merged.values()].reduce((sum,r) => sum + r.bytes, 0);
            const ghosts = [...merged.values()].filter(r => r.ghost).sort((a,b) => a.order-b.order);
            while (ghosts.length > 8 || (bytes > this.cap && ghosts.length)) {
                const r = ghosts.shift();
                merged.delete(r.id);
                bytes -= r.bytes;
            }
            if (bytes > this.cap) throw new Error("Tape is full. Download the unsaved take or delete saved takes.");
            for (const r of existing) if (!merged.has(r.id)) await tx.store.delete(r.id);
            for (const r of records) if (merged.has(r.id)) await tx.store.put(merged.get(r.id));
            await done;
            this.error.setState({value: ""});
            await this.refresh();
        } catch (error) {
            try {tx.abort();} catch { /* Already aborted or completed. */ }
            await done.catch(() => {});
            this.error.setState({value: error.name === "QuotaExceededError" ? "Browser storage is full. Download your unsaved takes." : error.message});
            throw error;
        } finally {
            signal?.removeEventListener("abort", abort);
        }
    }
}

export {TapeStore};
