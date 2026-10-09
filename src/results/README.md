# Tape files and simulation results

`take/` groups take creation, validation, restoration and probability tables by responsibility:
`schema.js` defines stored shapes, `values.js` encodes matrices and non-finite numbers,
`snapshot.js` creates and restores snapshots, `validation.js` checks circuits and dimensions,
`displays.js` validates display results and Sample outcomes, and `distributions.js` computes
probability tables. Snapshots read collected histories through `CircuitStats.snapshotData()`;
the engine owns their internal storage. Tape owns number encoding and displayed-wire padding,
and retains the existing circuit serializer.

`files/` contains `json.js` for take/album import and export, `csv.js` for probability CSV,
`link.js` for portable links, and `limits.js` for shared size limits. These modules have no DOM
access. `takeLink(take, base)` receives its base URL from the caller. `LINK_LIMIT` is also used
by the URL loader. `tapeStore.js` owns IndexedDB admission, eviction and atomic writes.

The application `Recorder` coordinates these operations. React panels own selection and editing
controls, and use `src/browser/downloadFile.js` to download already formatted content.

`shadow-quant-take/1` stores `id`, `name`, `colour` (0–7), `recorded` (UTC ISO date),
`notes`, the complete serialized `circuit`, displayed `wires`, `step` (columns already
executed), animation `phase` in [0,1), `seed`, `randomFormat`, `result` (playhead),
`fullResult` (the whole circuit at the same phase and seed), and `measurement`.

`measurement` holds `shots`, its own `seed` and `counts`: the displayed wires measured `shots`
times in the computational basis from `result`'s amplitudes, as `[basis index, count]` pairs in
index order. The counts follow from the amplitudes, shots and seed alone, so import recomputes
them and rejects a take whose counts differ. An unavailable result has no counts. Takes recorded
before measurements were kept have no `measurement`, and still import. The counts are right after a
deferred `Measure` too: a measured qubit is never put back into superposition (GateColumn's "no
remix"), so measuring every wire at the end gives the statistics of measuring where `Measure` stands.
The counts add to a take's size, at most one pair per basis state seen: a take near the 32 KiB
link limit may no longer fit a link, and travels as a JSON file instead. The settings hold the
shots to 10000, so a take measures in a few milliseconds.

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
numeric value, optional label, bits (highest bit first), probability, and the measured count
(empty for a take without a measurement). `joint` rows retain
the whole basis-state distribution; unnamed wires are individual `qN` groups. Spreadsheet
formula prefixes are escaped in text cells. CSV does not restore circuits or amplitudes.

Portable links use `#take=` followed by `encodeURIComponent(JSON.stringify(take))`.
The complete encoded fragment must fit 32 KiB; larger results travel as JSON files.
No identifier depends on another browser's local storage or a server.

IndexedDB admission counts UTF-8 JSON bytes, caps the tape at 200 MiB, and retains at most
eight ghosts. Oldest ghosts are evicted first. Saved takes are never evicted automatically.
Batch writes are atomic. Storage failure leaves the batch available for download, without
reporting it as saved. Browser quota and storage deletion remain outside the app's control.
