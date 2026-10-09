import {clock} from '../../base/Clock.js';
import {createValueStore} from '../../base/valueStore.js';

import {Serializer} from "../../serialization/Serializer.js";
import { createTake, restoreTake } from "../../results/take/snapshot.js";
import {freshSeed} from "../../engine/simulation/random.js";
import { parseTakes } from "../../results/files/json.js";
import { MAX_FILE_BYTES } from "../../results/files/limits.js";
import { motionSettings } from "../../state/motionSettings.js";

/**
 * Records takes, and only when the user asks: one take, a whole run, or a recording the user starts
 * and stops, which takes a sample at the user's sampling rate. Every take measures its state, as
 * many shots as the user set. Ghosts - a take of the circuit before each edit - are kept only once
 * the user turns them on.
 */
class Recorder {
    /**
     * @param {!{onRestore: (undefined|!function(): void),
     *     settings: (undefined|import("zustand/vanilla").StoreApi),
     *     every: (undefined|!function(!number, !function(): void): !function(): void)}} options
     *     onRestore runs after the saved result is published, while restore guards are active. The
     *     settings give the sampling rate and the shots; `every` times the samples, on the app's clock
     *     unless a test winds its own.
     */
    constructor(revision, playhead, simulator, store, capture,
                {onRestore, settings = motionSettings, every = (millis, callback) => clock.every(millis, callback)} = {}) {
        Object.assign(this, {revision, playhead, simulator, store, capture});
        this._onRestore = onRestore;
        this._settings = settings;
        this._every = every;
        this.busy = createValueStore(false);
        this.unsaved = createValueStore([]);
        this.ghostsEnabled = createValueStore(false);
        /** Whether a recording the user started is taking samples. */
        this.recording = createValueStore(false);
        /** How many samples the recording under way has saved. */
        this.samples = createValueStore(0);
        /** Why the last recording stopped on its own, if it did. */
        this.recordingError = createValueStore("");
        /** @type {undefined|!Object} A take opened from a link: shown and restored, saved only when kept. */
        this.linked = createValueStore(undefined);
        this.batch = undefined;
        this.suppressGhost = false;
        this.restoring = false;
        this._stopSampling = undefined;
        this._pendingSample = undefined;
        /** Counts the recordings started, so a write still in flight from one never counts in the next. */
        this._session = 0;
        revision.beforeCommit().subscribe(() => {
            if (this.suppressGhost || !this.ghostsEnabled.getState().value) return;
            const take = this.makeTake();
            store.write([take], {ghost: true}).catch(() => {});
        });
        // A new rate applies to the recording under way from its next sample.
        settings.subscribe((state, previous) => {
            if (state.sampleRateHz !== previous.sampleRateHz && this._stopSampling !== undefined) {
                this._stopSampling();
                this._startSampling();
            }
        });
    }

    /** The settings the recorder samples and measures by, for the controls that set them. */
    get settings() {
        return this._settings;
    }

    makeTake(result = this.capture()) {
        // Takes still being written count too, so two made while a write is in flight get two numbers.
        const ids = new Set([...this.store.items.getState().value.filter(r => !r.ghost).map(r => r.id),
            ...this.unsaved.getState().value.map(t => t.id)]);
        const n = ids.size + 1;
        return createTake(result, `take ${n}`, (n - 1) % 8, {shots: this._settings.getState().shots});
    }

    /**
     * Runs an edit that is no edit of the user's own - loading an example - without a ghost of it.
     * @param {!function(): void} action
     */
    withoutGhosts(action) {
        const suppressed = this.suppressGhost;
        this.suppressGhost = true;
        try {action();} finally {this.suppressGhost = suppressed;}
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

    /**
     * Starts a recording: a sample now, and another at every period of the sampling rate, until
     * stop(). The animation runs on meanwhile, at the user's pace, so the samples follow it.
     */
    start() {
        if (this.recording.getState().value || this.busy.getState().value) return;
        this.recordingError.setState({value: ""});
        this.samples.setState({value: 0});
        this.recording.setState({value: true});
        this._sample();
        this._startSampling();
    }

    stop() {
        this._stopSampling?.();
        this._stopSampling = undefined;
        // A sample still being written finishes, but no longer belongs to any recording.
        this._session++;
        this._pendingSample = undefined;
        this.recording.setState({value: false});
    }

    /** @private */
    _startSampling() {
        this._stopSampling = this._every(1000 / this._settings.getState().sampleRateHz, () => this._sample());
    }

    /**
     * Saves one sample, unless the last is still being written: a slow store drops samples rather than
     * queueing them. A failed write ends the recording and says why.
     * @private
     */
    _sample() {
        if (this._pendingSample !== undefined) return;
        const session = this._session;
        const pending = this.record().then(() => {
            if (session === this._session) this.samples.setState({value: this.samples.getState().value + 1});
        }, error => {
            if (session !== this._session) return;
            this.stop();
            this.recordingError.setState({value: error.message});
        }).finally(() => {
            if (this._pendingSample === pending) this._pendingSample = undefined;
        });
        this._pendingSample = pending;
    }

    async recordRun() {
        if (this.busy.getState().value || this.recording.getState().value) return;
        this.playhead.pause();
        const initial = this.capture();
        // Every step records at the captured phase: the animation cycle stands still until the run ends.
        const releaseClock = this.simulator.holdClock();
        const checkpoint = this.revision.peekActiveCommit();
        const token = new AbortController();
        const shots = this._settings.getState().shots;
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
                const take = createTake(result, `run step ${step}`, step % 8, {shots});
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

    /**
     * Shows a take: its circuit, its step and its saved results. Either all of it is shown or none:
     * a failure after the circuit was committed takes the commit back.
     */
    restore(take) {
        const result = restoreTake(take);
        // A restored take pins the phase; a recording would only sample it over and over.
        this.stop();
        this.playhead.pause();
        const {suppressGhost, restoring} = this;
        this.suppressGhost = true;
        this.restoring = true;
        const before = this.revision.peekActiveCommit();
        try {
            this.revision.commit(JSON.stringify(Serializer.toJson(result.circuit)));
            this.playhead.seek(take.step);
            this.simulator.restore(result);
            this._onRestore?.();
        } catch (error) {
            // Taken back as an ordinary circuit change, so the app shows and simulates it again.
            this.restoring = restoring;
            if (this.revision.peekActiveCommit() !== before) this.revision.undo();
            throw error;
        } finally {
            this.suppressGhost = suppressGhost;
            this.restoring = restoring;
        }
    }

    /**
     * Shows and restores the one take a link carries, without saving it: opening a link records
     * nothing until the user keeps the take.
     * @param {!string} text The link's take JSON.
     * @returns {!Object} The take.
     */
    openLink(text) {
        const [take] = parseTakes(text);
        this.linked.setState({value: undefined});
        this.restore(take);
        this.linked.setState({value: take});
        return take;
    }

    /** Leaves the take a link brought unsaved and no longer shown: another address was opened. */
    closeLink() {
        this.linked.setState({value: undefined});
    }

    /**
     * Saves the linked take, as edited on its card.
     * @param {!Object} take
     */
    async keepLinked(take = this.linked.getState().value) {
        if (take === undefined) throw new Error("There is no take from a link to keep.");
        const [kept] = await this._admit([take]);
        this.linked.setState({value: undefined});
        return kept;
    }

    async importText(text) {
        return this._admit(parseTakes(text));
    }

    /**
     * Saves validated takes; one whose id is taken by a different take gets a fresh id.
     * @private
     */
    async _admit(takes) {
        await this.store.ready;
        const existing = new Map(this.store.items.getState().value.map(r => [r.id, r.take]));
        const imported = takes.map(t => existing.has(t.id) && JSON.stringify(existing.get(t.id)) !== JSON.stringify(t) ?
            {...t, id: freshSeed()} : t);
        await this.save(imported);
        return imported;
    }

}

export {Recorder};
