import { createValueStore } from "../base/valueStore.js";
import { openDB } from "idb";

import { MAX_FILE_BYTES } from "./files/limits.js";
import { whenIdle } from "./idle.js";
import { jsonBytes } from "./take/size.js";

const MAX_GHOSTS = 8;
const ignore = () => {};

function recordsFor(takes, ghost, order) {
  return takes.map((take, i) => {
    const stamp = order + i / 1000;
    // The record is sized without its own `bytes`, as it was when it was serialised to measure it.
    return {
      id: take.id,
      take,
      ghost,
      order: stamp,
      bytes: jsonBytes({ id: take.id, take, ghost, order: stamp }),
    };
  });
}

/**
 * One transaction owns admission, ghost eviction and a batch's writes.
 *
 * Every record is also kept in memory, so a write decides what to admit and evict without reading
 * the store back, and publishes the result without reading it again. The index can only go stale
 * through another tab, which says so on a channel; the next write then reads the store afresh.
 *
 * Automatic ghosts are deferred: they are built and written when the page is idle, so that an
 * edit does not wait for them. Any other operation on the tape writes the ones still waiting
 * first, in the order they were deferred.
 */
class TapeStore {
  /** `schedule` runs a callback when the page is idle; tests pass their own. */
  constructor(
    name = "shadow-quant-tape",
    cap = MAX_FILE_BYTES,
    schedule = whenIdle,
  ) {
    this.cap = cap;
    this.items = createValueStore([]);
    this.error = createValueStore("");
    this.recovery = createValueStore(null);
    this.recovering = createValueStore(false);
    this._schedule = schedule;
    /** Ghosts deferred but not yet built, oldest first. */
    this._pending = [];
    this._drainScheduled = false;
    /** Every record by id, ordered as the store holds them: what admission and eviction decide from. */
    this._index = new Map();
    /** True until the index has been read, and again after another tab writes. */
    this._stale = true;
    /** Reads and writes run one after another, because each decides from the index the last one left. */
    this._queue = Promise.resolve();
    this.db = openDB(name, 1, {
      upgrade: (db) => db.createObjectStore("takes", { keyPath: "id" }),
      blocked: () =>
        this.error.setState({
          value: "Close older app tabs to open Recordings storage.",
        }),
      blocking: () => this.db.then((db) => db.close()),
      terminated: () =>
        this.error.setState({
          value: "Recordings storage closed unexpectedly. Reload to reopen it.",
        }),
    });
    if (typeof BroadcastChannel === "function") {
      this._channel = new BroadcastChannel(name);
      this._channel.onmessage = () => {
        this._stale = true;
      };
    }
    // A page being hidden may be about to close, and an idle task may then never come: the ghosts
    // still waiting are written at once, so a tab closed straight after an edit keeps its ghost.
    if (typeof document !== "undefined") {
      const writeWaiting = () => {
        if (this._pending.length > 0) void this.flush();
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") writeWaiting();
      });
      globalThis.addEventListener?.("pagehide", writeWaiting);
    }
    this.ready = this.refresh().catch((error) => {
      this.error.setState({ value: error.message });
    });
  }

  /** Reads the whole store again, once every ghost still waiting is written. */
  refresh() {
    return this._afterGhosts(() => this._reload());
  }

  /** Resolves once every ghost deferred so far, and every earlier write, is in the store. */
  flush() {
    return this._afterGhosts(() => {});
  }

  /**
   * Queues an automatic ghost. `build` makes the take when the page is idle, or sooner if
   * anything else touches the tape, so it must give the same take whenever it runs. The time
   * the ghost was committed is what orders it.
   */
  deferGhost(build) {
    this._pending.push({ build, order: Date.now() });
    // Once the newer ghosts are written the tape evicts any beyond its limit, oldest first, so
    // the oldest of too many waiting would never be seen: skip building it.
    if (this._pending.length > MAX_GHOSTS) this._pending.shift();
    if (this._drainScheduled) return;
    this._drainScheduled = true;
    this._schedule(() => {
      this._drainScheduled = false;
      this.flush();
    });
  }

  async write(takes, { ghost = false, remove = [], signal } = {}) {
    const records = recordsFor(takes, ghost, Date.now());
    return this._afterGhosts(() => this._commit(records, remove, signal));
  }

  /** Capture the authoritative record only after earlier writes and transaction resync. */
  delete(id) {
    return this._afterGhosts(async () => {
      let deleted;
      await this._commit([], [id], undefined, () => {
        deleted = this._index.get(id);
        if (!deleted)
          throw new Error(
            "This snapshot is already gone. Refresh Recordings to see current snapshots.",
          );
        return [];
      });
      this.recovery.setState({ value: structuredClone(deleted) });
    });
  }

  undoDelete() {
    if (this.recovering.getState().value) return Promise.resolve();
    this.recovering.setState({ value: true });
    return this._afterGhosts(async () => {
      const record = this.recovery.getState().value;
      if (!record) return;
      await this._commit(
        [],
        [],
        undefined,
        () => {
          if (this._index.has(record.id))
            throw new Error(
              "A snapshot with this ID already exists. Download the deleted snapshot before resolving the conflict.",
            );
          return record.ghost
            ? recordsFor(
                [record.take],
                true,
                [...this._index.values()].reduce(
                  (latest, r) => Math.max(latest, r.order + 1),
                  Date.now(),
                ),
              )
            : [record];
        },
        record.id,
      );
      this.recovery.setState({ value: null });
    }).finally(() => this.recovering.setState({ value: false }));
  }

  dismissRecovery() {
    return this._afterGhosts(() => this.recovery.setState({ value: null }));
  }

  /** Runs `job` after the ghosts deferred before this call are written, and after earlier jobs. */
  _afterGhosts(job) {
    const earlier = this._pending.splice(0);
    const run = this._queue.then(async () => {
      await this._writeGhosts(earlier);
      return job();
    });
    this._queue = run.catch(ignore);
    return run;
  }

  async _writeGhosts(entries) {
    for (const { build, order } of entries) {
      let records;
      try {
        records = recordsFor([build()], true, order);
      } catch (error) {
        this._fail(error);
        continue;
      }
      // A failed commit has reported itself, and the ghosts after it are still wanted.
      await this._commit(records).catch(ignore);
    }
  }

  async _reload() {
    const db = await this.db;
    return this._resync(() => db.getAll("takes"));
  }

  /** Replaces the index and items with what `readAll` returns from the store. */
  async _resync(readAll) {
    // Cleared first, so that a write another tab announces while this reads is not forgotten.
    this._stale = false;
    try {
      this._adopt(await readAll());
    } catch (error) {
      this._stale = true;
      throw error;
    }
  }

  _adopt(records) {
    records.sort((a, b) => a.order - b.order);
    this._index = new Map(records.map((r) => [r.id, r]));
    this.items.setState({ value: records });
  }

  _fail(error) {
    this.error.setState({
      value:
        error.name === "QuotaExceededError"
          ? "Browser storage is full. Download your unsaved snapshots."
          : error.message,
    });
  }

  /** @param {(() => any[]) | undefined} prepare */
  async _commit(
    records,
    remove = [],
    signal = undefined,
    prepare = undefined,
    requiredId = undefined,
  ) {
    const db = await this.db;
    signal?.throwIfAborted();
    const tx = db.transaction("takes", "readwrite");
    const abort = () => {
      try {
        tx.abort();
      } catch {
        /* Already finished. */
      }
    };
    signal?.addEventListener("abort", abort, { once: true });
    // Observe rejection immediately, including aborts caused before awaiting tx.done.
    const done = tx.done;
    done.catch(ignore);
    try {
      // Recovery always reads the transaction: another tab's broadcast may still be in flight.
      if (this._stale || prepare) await this._resync(() => tx.store.getAll());
      if (prepare) records = prepare();
      const merged = new Map(this._index);
      remove.forEach((id) => merged.delete(id));
      records.forEach((r) =>
        merged.set(r.id, { ...r, order: merged.get(r.id)?.order ?? r.order }),
      );
      let bytes = [...merged.values()].reduce((sum, r) => sum + r.bytes, 0);
      const ghosts = [...merged.values()]
        .filter((r) => r.ghost)
        .sort((a, b) => a.order - b.order);
      while (
        ghosts.length > MAX_GHOSTS ||
        (bytes > this.cap && ghosts.length)
      ) {
        const r = ghosts.shift();
        merged.delete(r.id);
        bytes -= r.bytes;
      }
      if (requiredId && !merged.has(requiredId))
        throw new Error(
          "The deleted automatic snapshot does not fit in Recordings storage. Download it or free space, then retry Undo.",
        );
      if (bytes > this.cap)
        throw new Error(
          "Recordings storage is full. Download the unsaved snapshot or delete saved snapshots.",
        );
      // Requests are not awaited one by one: a failed request aborts the transaction, and `done` rejects.
      for (const id of this._index.keys())
        if (!merged.has(id)) tx.store.delete(id).catch(ignore);
      for (const r of records)
        if (merged.has(r.id)) tx.store.put(merged.get(r.id)).catch(ignore);
      await done;
      this._adopt([...merged.values()]);
      this.error.setState({ value: "" });
      this._channel?.postMessage(null);
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* Already aborted or completed. */
      }
      await done.catch(ignore);
      this._fail(error);
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }
}

export { TapeStore };
