# Circuit code

Files are grouped by their primary purpose. Filenames and exported symbols remain unchanged.

```text
circuit/
├── model/
│   ├── CircuitDefinition.js
│   ├── Controls.js
│   ├── CustomGateSet.js
│   ├── Gate.js
│   ├── GateCheckArgs.js
│   └── GateColumn.js
├── serialization/
│   └── Serializer.js
└── simulation/
    ├── CircuitComputeUtil.js
    ├── CircuitEvalContext.js
    ├── CircuitExecution.js
    ├── CircuitStats.js
    └── gpu/
        ├── CircuitShaders.js
        ├── GateShaders.js
        ├── KetShaderUtil.js
        └── KetTextureUtil.js
```

## Models

`CircuitDefinition` describes the circuit layout, initial states and gate context. `Gate` and
`GateBuilder` describe and construct operations; `GateColumn` groups them into columns.
`Controls` represents the bit requirements for controlled operations. `GateCheckArgs` carries
the inputs for gate-disable checks, and `CustomGateSet` holds user-defined gates.

## Serialization

`Serializer` converts circuits, gates and supported mathematical values to and from JSON.
It also configures custom gates reconstructed from saved circuits.

## Simulation

`CircuitEvalContext` carries the current state and execution inputs. `CircuitExecution` applies
initial-state and column operations. `CircuitComputeUtil` advances an entire circuit, collects
requested statistics and configures circuit-backed gates. `CircuitStats` computes and exposes
amplitudes, probabilities, density matrices and display statistics.

The `gpu/` directory contains circuit-specific WebGL work: `CircuitShaders` initializes and
inspects states, `GateShaders` applies gate operations, `KetShaderUtil` constructs ket shaders,
and `KetTextureUtil` manages state-texture transformations and readback. General WebGL resources
and shader infrastructure live in `src/webgl/`.

## References and tests

Import the owning file directly. Existing relationships remain in place: for example,
`CircuitDefinition` delegates execution to `CircuitExecution`, while `Serializer` uses
`CircuitComputeUtil` when reconstructing circuit-backed gates. Directory placement does not
introduce new dependency restrictions.

`test/circuit/` mirrors this hierarchy for the existing unit tests. The recursive test discovery
includes these subdirectories. Run `npm test`, `npm run test:e2e` and `npm run test:perf` from the
repository root to check simulation, application integration and the existing performance cases.
