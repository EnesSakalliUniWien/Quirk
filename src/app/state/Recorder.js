import {createValueStore} from '../../base/valueStore.js';

import {Serializer} from "../../serialization/Serializer.js";
import { createTake, restoreTake } from "../../results/take/snapshot.js";
import {freshSeed} from "../../engine/simulation/random.js";
import { parseTakes } from "../../results/files/json.js";
import { MAX_FILE_BYTES } from "../../results/files/limits.js";

class Recorder {
    /** onRestore runs after the saved result is published, while restore guards are active. */
    constructor(revision, playhead, simulator, store, capture, {onRestore} = {}) {
        Object.assign(this, {revision, playhead, simulator, store, capture});
        this._onRestore = onRestore;
        this.busy = createValueStore(false);
        this.unsaved = createValueStore([]);
        this.ghostsEnabled = createValueStore(true);
        this.batch = undefined;
        this.suppressGhost = false;
        this.restoring = false;
        revision.beforeCommit().subscribe(() => {
            if (this.suppressGhost || !this.ghostsEnabled.getState().value) return;
            const take = this.makeTake();
            store.write([take], {ghost: true}).catch(() => {});
        });
    }

    makeTake(result = this.capture()) {
        const n = this.store.items.getState().value.filter(r => !r.ghost).length + 1;
        return createTake(result, `take ${n}`, (n - 1) % 8);
    }

    async save(takes, options = {}) {
        const ids = new Set(takes.map(t => t.id));
        this.unsaved.setState({value: [...this.unsaved.getState().value.filter(t => !ids.has(t.id)), ...takes]});
        try {await this.store.write(takes, options);} catch (error) {
            if (options.signal?.aborted) this.unsaved.setState({value: this.unsaved.getState().value.filter(t => !ids.has(t.id))});
            throw error;
        }
        this.unsaved.setState({value: this.unsaved.getState().value.filter(t => !ids.has(t.id))});
        return takes;
    }

    async record() {
        return this.save([this.makeTake()]);
    }

    async recordRun() {
        if (this.busy.getState().value) return;
        this.playhead.pause();
        const initial = this.capture();
        // Every step records at the captured phase: the animation cycle stands still until the run ends.
        const releaseClock = this.simulator.holdClock();
        const checkpoint = this.revision.peekActiveCommit();
        const token = new AbortController();
        this.batch = token;
        this.busy.setState({value: true});
        try {
            const takes = [];
            let bytes = 0;
            for (let step = 0; step <= initial.circuit.columns.length; step++) {
                await new Promise(resolve => setTimeout(resolve, 0));
                if (token.signal.aborted || this.batch !== token || checkpoint !== this.revision.peekActiveCommit() || this.simulator.playing ||
                    this.simulator.seed !== initial.seed || this.simulator.cycleTime() !== initial.phase) {
                    throw new Error("Whole-run recording cancelled; no takes were saved.");
                }
                const result = this.simulator.evaluate(initial.circuit, initial.wireCount, step, false);
                const take = createTake(result, `run step ${step}`, step % 8);
                takes.push(take);
                bytes += new TextEncoder().encode(JSON.stringify(take)).byteLength;
                if (bytes > MAX_FILE_BYTES) throw new Error("Whole run exceeds the 200 MiB limit. Record fewer steps individually.");
            }
            await this.save(takes, {signal: token.signal});
        } finally {
            releaseClock();
            this.batch = undefined;
            this.busy.setState({value: false});
        }
    }

    cancel() {this.batch?.abort();}

    restore(take) {
        const result = restoreTake(take);
        this.playhead.pause();
        this.suppressGhost = true;
        this.restoring = true;
        try {
            this.revision.commit(JSON.stringify(Serializer.toJson(result.circuit)));
            this.playhead.seek(take.step);
            this.simulator.restore(result);
            this._onRestore?.();
        } finally {
            this.suppressGhost = false;
            this.restoring = false;
        }
    }

    async importText(text) {
        const takes = parseTakes(text);
        await this.store.ready;
        const existing = new Map(this.store.items.getState().value.map(r => [r.id, r.take]));
        const imported = takes.map(t => existing.has(t.id) && JSON.stringify(existing.get(t.id)) !== JSON.stringify(t) ?
            {...t, id: freshSeed()} : t);
        await this.save(imported);
        return imported;
    }

}

export {Recorder};
