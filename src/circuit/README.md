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
└── serialization/
    └── Serializer.js
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

Simulation moved to `src/engine/simulation/`, next to the math and WebGL code it depends on, so
that every calculation lives under one namespace. See `src/engine/README.md`.

## References and tests

Import the owning file directly. Existing relationships remain in place: for example,
`CircuitDefinition` delegates execution to `engine/simulation/CircuitExecution`, while
`Serializer` uses `engine/simulation/CircuitComputeUtil` when reconstructing circuit-backed
gates. Directory placement does not introduce new dependency restrictions.

`test/circuit/` mirrors this hierarchy for the existing unit tests. The recursive test discovery
includes these subdirectories. Run `npm test`, `npm run test:e2e` and `npm run test:perf` from the
repository root to check the models, application integration and the existing performance cases.
