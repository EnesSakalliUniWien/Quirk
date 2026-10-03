# Engine code

Every calculation Quirk performs lives here, so the numeric core can be understood, tested and
generalised in one place. `math/` and `webgl/` are leaves: each depends only on the ones listed
before it, on `src/base/` and on `src/config/`. `simulation/` is not a leaf - it evaluates the
circuit model with the catalogue's gates, so it imports `src/circuit/`, `src/gates/` and
`src/serialization/` and sits above them in the dependency order CONTRIBUTING gives.

```text
engine/
├── math/           pure numerics: complex numbers, formulas, matrices (see math/README.md)
├── webgl/          the WebGL backend: context/, shader/, texture/, coder/ (see webgl/README.md)
└── simulation/     circuit simulation on the backend
    ├── CircuitEvalContext.js   the state and inputs one circuit column is evaluated with
    ├── CircuitExecution.js     applies initial states and columns
    ├── CircuitComputeUtil.js   advances a whole circuit, or the rest of it, and collects statistics
    ├── CircuitRun.js           one run on the GPU, and reading what it leaves, with or without waiting
    ├── StablePrefix.js         the state after the columns that do not move with time, kept on the GPU
    ├── CircuitStats.js         amplitudes, probabilities, density matrices, display data
    └── gpu/                    WebGL kets: state textures, ket shaders, gate shaders
        ├── KetTextureUtil.js
        ├── KetShaderUtil.js
        ├── GateShaders.js
        └── CircuitShaders.js
```

## math

Value types and algorithms with no GPU or circuit knowledge. `Matrix` holds gate matrices as an
interleaved real and imaginary `Float64Array`, the same layout the GPU buffers use.

## webgl

The single WebGL2 abstraction, grouped by responsibility: `context/` owns the one shared GL
context, `shader/` the programs and their arguments, `texture/` the GPU memory, and `coder/` the
array layouts, one value per RGBA32F pixel addressed with `texelFetch`. WebGL2 with float render
targets is required; there is no byte-packing fallback any more. This is the only directory that
talks to the browser's GPU API, so a WebGPU backend belongs beside it as a sibling, not inside it.

## simulation

The state vector lives in textures managed by `KetTextureUtil`; `KetShaderUtil` generates the
per-gate fragment shaders; `CircuitExecution` and `CircuitComputeUtil` run a circuit column by
column; `CircuitStats` reads results back for the displays. The `gpu/` directory is WebGL specific
and is the part a WebGPU backend replaces.

A run is two steps. `CircuitRun.runCircuit` applies the columns on the GPU and leaves textures: the
final state, and for every column the qubit densities, the survival rate and each display's data,
which the GPU works out from the state as it passes. Reading them is the slow part, since the GPU
does its work when its results are asked for. `readRun` waits for it, and reads everything in one
`mergedReadFloats`. `startReadingRun` does not wait: it reads into a buffer behind a fence, and its
`poll` fetches the pixels a frame or more later (see `webgl/README.md`). `CircuitStats` turns the pixels
into stats, and is the same whichever way they were read: `fromCircuitAtTime` waits, and
`startFromCircuitAtTime` returns a `PendingCircuitStats` to poll.

The columns before a circuit's first time-dependent gate give the same answer at every time, so a
circuit that spins is not run again from |0...0>. A `StablePrefix` keeps the state after them in a
texture, with the pixels already read for their stats, and a run given one starts there and applies
only the columns that move. It is keyed on everything the prefix depends on: its columns, the wire
count, the initial values, the registers and the seed. A prefix whose evaluation drew random numbers
(a detector) is not kept, since a run that began after it would start the seeded stream from the wrong
place: the run counts the draws, and the circuit is simply run in full from then on. The texture is
freed when the circuit changes to one with nothing to keep, and a prefix made before the context was
lost is dropped, not used. Whoever holds a `StablePrefix` must `release` it, or the pool counts the
texture as leaked.

A playhead standing inside the circuit needs the stats of its first columns as well as the whole
circuit's. Those are the whole run's stats for the first columns, and the state after them, so
`CircuitStats.fromCircuitAtTimeWithPlayhead` takes both from one run: the run keeps a packed copy of
the state at the playhead's column, and its stats are the first columns' of the whole run, with the
state renormalized by the chance of surviving to there as a run of just those columns would leave
it. The wires its circuit leaves out stay |0>, so its amplitudes are the first of the copy's. A run
that starts from a kept prefix past the playhead has no state there to copy; but then the playhead
is before the first moving column and its stats do not change with time, so they are made once.

A run that fails part way, because a gate's effect throws or the GPU runs out of memory, gives back
every texture it took: the state it holds, the stats it had collected and the copies it made for the
prefix and the playhead. `fromCircuitAtTime` then answers with NaN stats, and may do so every frame of
an animated circuit, so none of them can stay out of the pool.

The panels that trace a circuit step by step take every step's state from one run:
`CircuitStats.statesAfterSteps` keeps a packed copy of the state after each wanted column and
reads them all back together, renormalized by the chance of surviving to each, as a run of just
those columns would leave them, and padded to the wires on screen as they are read. `stepStates` in
`stepAlgebra.js` shares the answer between the Algebra, Bloch and Probabilities panels and keeps the
states before the first time-dependent column, so a spinning gate reads back only the states from
its own column on. Given the simulator's `StablePrefix`, the run for the rest starts from the state
it keeps and applies only the columns that move, as long as no wanted step is before its end: the
prefix holds the state at its last column alone. The states are bit for bit those of a run from the
start. These read at the panels' own pace and wait for the GPU. The shared states are every state of
the circuit, so `releaseStepStates` lets go of them when the panels that trace the circuit close.

`src/app/state/Simulator.js` decides which of these a frame uses. A circuit that moves with time,
unchanged since the last result, is run in the background by the redraw loop's frames: the frame
shows the last result while one run is in flight, and takes it when its fence has signalled. After
an edit, for a new step or seed, and while the animation cycle stands still, the circuit is run at
once and the wait is paid, so a frame never shows stats of the wrong circuit or time.

## Dependencies

`simulation` imports `circuit/model` for gates and controls and `gates/AllGates` for the gate
table, and `gates/` imports the ket shaders back. That cycle predates this layout and is resolved at
run time, not import time.

## Tests

`test/engine/` mirrors this directory. Run `npm test` for the unit suites, `npm run test:e2e` for
the browser flows and `npm run test:perf` for the timing cases.
