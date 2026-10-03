# Tape files and simulation results

`take/` groups take creation, validation, restoration and probability tables by responsibility:
`schema.js` defines stored shapes, `values.js` encodes matrices and non-finite numbers,
`snapshot.js` creates and restores snapshots, `validation.js` checks circuits and dimensions,
`displays.js` validates display results and Sample outcomes, `distributions.js` computes
probability tables, and `size.js` estimates a record's serialised size. Snapshots read collected
histories through `CircuitStats.snapshotData()`; the engine owns their internal storage. Tape owns
number encoding and displayed-wire padding, and retains the existing circuit serializer.

`files/` contains `json.js` for take/album import and export, `csv.js` for probability CSV,
`link.js` for portable links, and `limits.js` for shared size limits. These modules have no DOM
access. `takeLink(take, base)` receives its base URL from the caller. `LINK_LIMIT` is also used
by the URL loader. `tapeStore.js` owns IndexedDB admission, eviction, atomic writes and the deferral
of automatic ghosts, which `idle.js` schedules.

The application `Recorder` coordinates these operations. React panels own selection and editing
controls, and use `src/browser/downloadFile.js` to download already formatted content.

`shadow-quant-take/1` stores `id`, `name`, `colour` (0–7), `recorded` (UTC ISO date),
`notes`, the complete serialized `circuit`, displayed `wires`, `step` (columns already
executed), animation `phase` in [0,1), `seed`, `randomFormat`, `result` (playhead),
and `fullResult` (the whole circuit at the same phase and seed).

Each result retains its simulated wire count and circuit, flat interleaved real/imaginary
`amplitudes` padded to the displayed wire count, per-column `survival`, per-column/per-wire
2×2 `densities` (eight interleaved numbers each), `custom` display entries keyed by `column:row`,
and `samples` keyed the same way. `readable` preserves the previous simulation export.
`available` is false for engine fallback results. A deferred `Measure` is represented by
the circuit's measurement masks and density matrices; its internal amplitudes are not
a complete physical pure-state description.

Matrices inside custom data use `{kind:"matrix", width, height, buffer}`. Non-finite
numbers are explicit `{unavailable:"NaN"}`, `{unavailable:"Infinity"}`, or
`{unavailable:"-Infinity"}` values. Existing nullable fields in the readable export
retain their original meaning. Optional undefined object properties are omitted.

`shadow-quant-album/1` contains `takes`, an array of these objects. Import validates the
entire array before any writes. Conflicting existing identities receive new ids; identical
imports retain their ids. Stored results are authoritative when restoring a take.
Resuming playback computes new results. The first random format is `seedrandom-arc4/1`;
detector simulations restart the same local generator for every prefix, without replacing
global randomness. Sample uses a separate generator keyed by seed and gate location.

CSV is an export-only probability table. It contains take id/name, register name/start/width,
numeric value, optional label, bits (highest bit first), and probability. `joint` rows retain
the whole basis-state distribution; unnamed wires are individual `qN` groups. Spreadsheet
formula prefixes are escaped in text cells. CSV does not restore circuits or amplitudes.

Portable links use `#take=` followed by `encodeURIComponent(JSON.stringify(take))`.
The complete encoded fragment must fit 32 KiB; larger results travel as JSON files.
No identifier depends on another browser's local storage or a server.

IndexedDB admission counts the UTF-8 JSON bytes of each record, caps the tape at 200 MiB, and
retains at most eight ghosts. The count is exact except for lists longer than 64 elements, which
`size.js` measures on an evenly spaced sample and scales, usually to within a percent: serialising
every amplitude to count it cost about as much as encoding the take. Oldest ghosts are evicted
first. Saved takes are never evicted automatically. Batch writes are atomic. Storage failure leaves
the batch available for download, without reporting it as saved. Browser quota and storage deletion
remain outside the app's control.

A ghost is recorded in two steps so that an edit does not wait for it. The commit only captures the
results it needs, by reference because results are immutable, and `TapeStore.deferGhost` builds,
sizes and writes the take when the page is idle: a background-priority task where the browser has
them, else an idle callback, else a timer. Every other operation on the store (a write, a deletion,
keeping a ghost, an import, `refresh`) first writes the ghosts still waiting, in commit order, so
none is missed or overtaken. Of more than eight waiting, only the newest eight are built, because
the limit would evict the rest as soon as they were written. The store keeps every record in memory:
admission and eviction decide from that index and publish `items` from it, rather than reading the
database back. Another tab announces its writes on a `BroadcastChannel`, and the next write here
then reads the database afresh.
