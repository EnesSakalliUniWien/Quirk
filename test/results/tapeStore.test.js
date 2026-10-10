import { Suite, assertThat, assertTrue } from "../TestUtil.js";
import { TapeStore } from "../../src/results/tapeStore.js";
import { whenIdle } from "../../src/results/idle.js";

const suite = new Suite("Tape store");

// The store only needs an id from a take, so these stand in for real ones without a simulator.
const fakeTake = (id) => ({ id, name: id, amplitudes: [1, 0, 0, 0] });
const ids = (store) => store.items.getState().value.map((r) => r.id);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** An idle scheduler that runs when the test says so. */
function manualIdle() {
  const callbacks = [];
  return {
    schedule: (callback) => callbacks.push(callback),
    scheduled: () => callbacks.length,
    run: () => callbacks.splice(0).forEach((callback) => callback()),
  };
}

async function discard(...stores) {
  const names = [];
  for (const store of stores) {
    const db = await store.db;
    names.push(db.name);
    db.close();
  }
  for (const name of new Set(names)) indexedDB.deleteDatabase(name);
}

function openStore(options = {}) {
  const name = options.name ?? `tape-store-test-${crypto.randomUUID()}`;
  const idle = options.idle ?? manualIdle();
  return { name, idle, store: new TapeStore(name, options.cap, idle.schedule) };
}

suite.test(
  "a deferred ghost is built and written only when the page is idle",
  async () => {
    const { store, idle } = openStore();
    try {
      await store.ready;
      let built = 0;
      store.deferGhost(() => {
        built++;
        return fakeTake("ghost");
      });
      assertThat(built).isEqualTo(0);
      assertThat(idle.scheduled()).isEqualTo(1);
      assertThat(ids(store)).isEqualTo([]);
      idle.run();
      await store.flush();
      assertThat(built).isEqualTo(1);
      assertThat(
        store.items.getState().value.map((r) => [r.id, r.ghost]),
      ).isEqualTo([["ghost", true]]);
      assertThat(
        (await (await store.db).getAll("takes")).map((r) => r.id),
      ).isEqualTo(["ghost"]);
    } finally {
      await discard(store);
    }
  },
);

suite.test("deferring many ghosts asks for one idle callback", async () => {
  const { store, idle } = openStore();
  try {
    await store.ready;
    for (let i = 0; i < 3; i++) store.deferGhost(() => fakeTake(`ghost-${i}`));
    assertThat(idle.scheduled()).isEqualTo(1);
    idle.run();
    await store.flush();
    store.deferGhost(() => fakeTake("later"));
    assertThat(idle.scheduled()).isEqualTo(1);
    idle.run();
    await store.flush();
    assertThat(ids(store)).isEqualTo([
      "ghost-0",
      "ghost-1",
      "ghost-2",
      "later",
    ]);
  } finally {
    await discard(store);
  }
});

suite.test(
  "deferred ghosts are built and written in commit order, with the same limit as direct writes",
  async () => {
    const deferred = openStore();
    const direct = openStore();
    try {
      await Promise.all([deferred.store.ready, direct.store.ready]);
      const built = [];
      for (let i = 0; i < 11; i++) {
        deferred.store.deferGhost(() => {
          built.push(i);
          return fakeTake(`ghost-${i}`);
        });
        await direct.store.write([fakeTake(`ghost-${i}`)], { ghost: true });
      }
      deferred.idle.run();
      await deferred.store.flush();
      assertThat(ids(direct.store)).isEqualTo(
        Array.from({ length: 8 }, (_, i) => `ghost-${i + 3}`),
      );
      assertThat(ids(deferred.store)).isEqualTo(ids(direct.store));
      // Those the limit would evict as soon as the later ones arrived are never built.
      assertThat(built).isEqualTo([3, 4, 5, 6, 7, 8, 9, 10]);
    } finally {
      await discard(deferred.store, direct.store);
    }
  },
);

suite.test(
  "ghosts deferred in the same millisecond keep their commit order",
  async () => {
    const { store, idle } = openStore();
    const realNow = Date.now;
    try {
      await store.ready;
      Date.now = () => 1000;
      for (const id of ["c", "a", "b"]) store.deferGhost(() => fakeTake(id));
      Date.now = realNow;
      idle.run();
      await store.flush();
      assertThat(ids(store)).isEqualTo(["c", "a", "b"]);
    } finally {
      Date.now = realNow;
      await discard(store);
    }
  },
);

suite.test("writing flushes the ghosts that are waiting first", async () => {
  const { store, idle } = openStore();
  try {
    await store.ready;
    const built = [];
    store.deferGhost(() => {
      built.push("g1");
      return fakeTake("g1");
    });
    store.deferGhost(() => {
      built.push("g2");
      return fakeTake("g2");
    });
    await store.write([fakeTake("saved")]);
    assertThat(built).isEqualTo(["g1", "g2"]);
    assertThat(ids(store)).isEqualTo(["g1", "g2", "saved"]);
    assertThat(store.items.getState().value.map((r) => r.ghost)).isEqualTo([
      true,
      true,
      false,
    ]);
    // The callback that was scheduled finds nothing left to do.
    idle.run();
    await store.flush();
    assertThat(built).isEqualTo(["g1", "g2"]);
    assertThat(ids(store)).isEqualTo(["g1", "g2", "saved"]);
  } finally {
    await discard(store);
  }
});

suite.test("deleting and keeping see the ghosts that are waiting", async () => {
  const { store } = openStore();
  try {
    await store.ready;
    store.deferGhost(() => fakeTake("g1"));
    store.deferGhost(() => fakeTake("g2"));
    await store.write([], { remove: ["g1"] });
    assertThat(ids(store)).isEqualTo(["g2"]);
    store.deferGhost(() => fakeTake("g3"));
    await store.write([{ ...fakeTake("g2"), name: "kept" }]);
    assertThat(
      store.items.getState().value.map((r) => [r.id, r.ghost, r.take.name]),
    ).isEqualTo([
      ["g2", false, "kept"],
      ["g3", true, "g3"],
    ]);
  } finally {
    await discard(store);
  }
});

suite.test("refreshing flushes the ghosts that are waiting first", async () => {
  const { store } = openStore();
  try {
    await store.ready;
    store.deferGhost(() => fakeTake("g1"));
    await store.refresh();
    assertThat(ids(store)).isEqualTo(["g1"]);
  } finally {
    await discard(store);
  }
});

suite.test(
  "a ghost that fails to build is reported, and the ones after it are still written",
  async () => {
    const { store } = openStore();
    try {
      await store.ready;
      store.deferGhost(() => {
        throw new Error("Could not encode the take.");
      });
      await store.flush();
      assertThat(store.error.getState().value).isEqualTo(
        "Could not encode the take.",
      );
      store.deferGhost(() => fakeTake("g2"));
      await store.flush();
      assertThat(ids(store)).isEqualTo(["g2"]);
      assertThat(store.error.getState().value).isEqualTo("");
    } finally {
      await discard(store);
    }
  },
);

suite.test(
  "a ghost larger than the cap is dropped without disturbing the rest",
  async () => {
    const { store } = openStore({ cap: 2000 });
    try {
      await store.ready;
      await store.write([fakeTake("saved")]);
      store.deferGhost(() => ({
        ...fakeTake("too-big"),
        notes: "x".repeat(5000),
      }));
      store.deferGhost(() => fakeTake("fits"));
      await store.flush();
      assertThat(ids(store)).isEqualTo(["saved", "fits"]);
    } finally {
      await discard(store);
    }
  },
);

suite.test(
  "writes decide from the index: they read nothing back after the first load",
  async () => {
    const { store } = openStore();
    const realGetAll = IDBObjectStore.prototype.getAll;
    let reads = 0;
    try {
      await store.ready;
      IDBObjectStore.prototype.getAll = function (...args) {
        reads++;
        return realGetAll.apply(this, args);
      };
      await store.write([fakeTake("saved")]);
      for (let i = 0; i < 10; i++)
        await store.write([fakeTake(`ghost-${i}`)], { ghost: true });
      await store.write([], { remove: ["saved"] });
      assertThat(reads).isEqualTo(0);
      assertThat(ids(store)).isEqualTo(
        Array.from({ length: 8 }, (_, i) => `ghost-${i + 2}`),
      );
      // What the index and items say is what the database holds.
      IDBObjectStore.prototype.getAll = realGetAll;
      const stored = (await (await store.db).getAll("takes")).sort(
        (a, b) => a.order - b.order,
      );
      assertThat(stored).isEqualTo(store.items.getState().value);
    } finally {
      IDBObjectStore.prototype.getAll = realGetAll;
      await discard(store);
    }
  },
);

suite.test(
  "records that did not change keep their identity across writes",
  async () => {
    const { store } = openStore();
    try {
      await store.ready;
      await store.write([fakeTake("a")]);
      const [before] = store.items.getState().value;
      await store.write([fakeTake("b")]);
      assertTrue(store.items.getState().value[0] === before);
    } finally {
      await discard(store);
    }
  },
);

suite.test(
  "a tape written by an earlier version loads and takes new writes",
  async () => {
    const { name, store: first } = openStore();
    await first.ready;
    // Records as the previous version stored them: the take, its flags, its order and the exact byte count.
    const legacy = ["old-saved", "old-ghost"].map((id, i) => {
      const record = {
        id,
        take: fakeTake(id),
        ghost: i === 1,
        order: 1000 + i,
        bytes: 0,
      };
      record.bytes = new TextEncoder().encode(
        JSON.stringify(record),
      ).byteLength;
      return record;
    });
    await Promise.all(
      legacy.map(async (record) => (await first.db).put("takes", record)),
    );
    (await first.db).close();
    const { store } = openStore({ name });
    try {
      await store.ready;
      assertThat(store.items.getState().value).isEqualTo(legacy);
      await store.write([fakeTake("new")]);
      assertThat(ids(store)).isEqualTo(["old-saved", "old-ghost", "new"]);
      for (let i = 0; i < 9; i++)
        await store.write([fakeTake(`ghost-${i}`)], { ghost: true });
      // The old ghost is the oldest, so it goes first; saved takes never do.
      assertThat(ids(store)).isEqualTo([
        "old-saved",
        "new",
        ...Array.from({ length: 8 }, (_, i) => `ghost-${i + 1}`),
      ]);
    } finally {
      await discard(store);
    }
  },
);

suite.test("a write notices that another tab has written", async () => {
  const { name, store: here } = openStore();
  const { store: there } = openStore({ name });
  try {
    await Promise.all([here.ready, there.ready]);
    const heard = new Promise((resolve) => {
      const channel = new BroadcastChannel(name);
      channel.onmessage = () => {
        channel.close();
        resolve();
      };
    });
    await there.write([fakeTake("theirs")]);
    await heard;
    await tick();
    // The index here has never heard of it, yet deleting it must work.
    await here.write([fakeTake("mine")], { remove: ["theirs"] });
    assertThat(ids(here)).isEqualTo(["mine"]);
    assertThat(
      (await (await here.db).getAll("takes")).map((r) => r.id),
    ).isEqualTo(["mine"]);
  } finally {
    await discard(here, there);
  }
});

suite.test(
  "whenIdle prefers background tasks, then idle callbacks, then a timer",
  () => {
    const task = () => {};
    const calls = [];
    whenIdle(task, {
      scheduler: { postTask: (...args) => calls.push(["postTask", ...args]) },
      requestIdleCallback: (...args) =>
        calls.push(["requestIdleCallback", ...args]),
      setTimeout: (...args) => calls.push(["setTimeout", ...args]),
    });
    whenIdle(task, {
      requestIdleCallback: (...args) =>
        calls.push(["requestIdleCallback", ...args]),
      setTimeout: (...args) => calls.push(["setTimeout", ...args]),
    });
    whenIdle(task, {
      setTimeout: (...args) => calls.push(["setTimeout", ...args]),
    });
    assertThat(calls.map((call) => call[0])).isEqualTo([
      "postTask",
      "requestIdleCallback",
      "setTimeout",
    ]);
    assertThat(calls[0][2]).isEqualTo({ priority: "background" });
    assertTrue(calls[1][2].timeout > 0);
    assertTrue(calls[2][2] > 0);
    assertTrue(calls.every((call) => call[1] === task));
  },
);

suite.test(
  "deletion captures queued metadata and restores exact saved records durably",
  async () => {
    const { name, store } = openStore();
    let reopened;
    try {
      await store.ready;
      await store.write([fakeTake("a"), fakeTake("b")]);
      const update = store.write([
        { ...fakeTake("a"), notes: "latest", name: "edited" },
      ]);
      const deletion = store.delete("a");
      await Promise.all([update, deletion]);
      const snapshot = store.recovery.getState().value;
      assertThat(snapshot.take.notes).isEqualTo("latest");
      assertThat(ids(store)).isEqualTo(["b"]);
      await store.undoDelete();
      assertThat(store.items.getState().value[0]).isEqualTo(snapshot);
      assertThat(store.recovery.getState().value).isEqualTo(null);
      reopened = openStore({ name }).store;
      await reopened.ready;
      assertThat(reopened.items.getState().value).isEqualTo(
        store.items.getState().value,
      );
      assertThat(reopened.recovery.getState().value).isEqualTo(null);
    } finally {
      await discard(...[store, reopened].filter(Boolean));
    }
  },
);

suite.test(
  "latest successful delete owns recovery; failed deletion and conflicts retain it",
  async () => {
    const { store } = openStore();
    try {
      await store.ready;
      await store.write([fakeTake("a"), fakeTake("b")]);
      await store.delete("a");
      const first = store.recovery.getState().value;
      await store.delete("missing").catch(() => {});
      assertThat(store.recovery.getState().value).isEqualTo(first);
      await store.write([fakeTake("c")]);
      const normalCap = store.cap;
      store.cap = 1;
      await store.delete("b").catch(() => {});
      assertThat(store.recovery.getState().value).isEqualTo(first);
      assertTrue(ids(store).includes("b"));
      store.cap = normalCap;
      await store.delete("b");
      const last = store.recovery.getState().value;
      assertThat(last.id).isEqualTo("b");
      await store.write([{ ...fakeTake("b"), notes: "newer" }]);
      await store.undoDelete().catch(() => {});
      assertThat(store.recovery.getState().value).isEqualTo(last);
      assertThat(
        store.items.getState().value.find((r) => r.id === "b").take.notes,
      ).isEqualTo("newer");
      await store.write([], { remove: ["b"] });
      await Promise.all([store.undoDelete(), store.undoDelete()]);
      assertThat(ids(store)).isEqualTo(["b", "c"]);
    } finally {
      await discard(store);
    }
  },
);

suite.test(
  "ghost Undo is newest, retains ghost status, and reports rejection without losing recovery",
  async () => {
    const { store } = openStore();
    try {
      await store.ready;
      await store.write([fakeTake("deleted")], { ghost: true });
      await store.delete("deleted");
      for (let i = 0; i < 8; i++)
        await store.write([fakeTake(`g${i}`)], { ghost: true });
      await store.undoDelete();
      assertThat(ids(store)).isEqualTo([
        ...Array.from({ length: 7 }, (_, i) => `g${i + 1}`),
        "deleted",
      ]);
      assertTrue(store.items.getState().value.at(-1).ghost);
      await store.delete("deleted");
      const snapshot = store.recovery.getState().value;
      store.cap = 1;
      await store.undoDelete().catch(() => {});
      assertThat(store.recovery.getState().value).isEqualTo(snapshot);
      assertTrue(!ids(store).includes("deleted"));
      assertTrue(store.error.getState().value.includes("does not fit"));
    } finally {
      await discard(store);
    }
  },
);

suite.test(
  "delete captures a stale index's current authoritative metadata",
  async () => {
    const { store } = openStore();
    try {
      await store.ready;
      await store.write([fakeTake("a")]);
      const current = {
        ...store.items.getState().value[0],
        take: { ...fakeTake("a"), notes: "other tab" },
      };
      await (await store.db).put("takes", current);
      // No broadcast has arrived: recovery operations still read the transaction itself.
      await store.delete("a");
      assertThat(store.recovery.getState().value).isEqualTo(current);
      await (
        await store.db
      ).put("takes", {
        ...current,
        take: { ...current.take, notes: "newer conflict" },
      });
      await store.undoDelete().catch(() => {});
      assertThat(store.recovery.getState().value).isEqualTo(current);
      assertThat(store.items.getState().value[0].take.notes).isEqualTo(
        "newer conflict",
      );
      await (await store.db).delete("takes", current.id);
      await store.undoDelete();
      assertThat(store.items.getState().value[0]).isEqualTo(current);
    } finally {
      await discard(store);
    }
  },
);
