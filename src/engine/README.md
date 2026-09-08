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
    ├── CircuitComputeUtil.js   advances a whole circuit and collects statistics
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

## Dependencies

`simulation` imports `circuit/model` for gates and controls and `gates/AllGates` for the gate
table, and `gates/` imports the ket shaders back. That cycle predates this layout and is resolved at
run time, not import time.

## Tests

`test/engine/` mirrors this directory. Run `npm test` for the unit suites, `npm run test:e2e` for
the browser flows and `npm run test:perf` for the timing cases.
