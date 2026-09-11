# Circuit code

Files are grouped by their primary purpose. Filenames and exported symbols remain unchanged.

```text
circuit/
├── registerLabels.js   how wires and basis states are written once wires have names
└── model/
    ├── CircuitDefinition.js
    ├── Controls.js
    ├── CustomGateSet.js
    ├── Gate.js
    ├── GateCheckArgs.js
    ├── GateColumn.js
    ├── InitialStates.js
    ├── InputLetters.js
    └── Registers.js
```

## Models

`CircuitDefinition` describes the circuit layout, initial states and gate context. `Gate` and
`GateBuilder` describe and construct operations; `GateColumn` groups them into columns.
`Controls` represents the bit requirements for controlled operations. `GateCheckArgs` carries
the inputs for gate-disable checks, and `CustomGateSet` holds user-defined gates.

`InitialStates` and `InputLetters` are leaf modules holding the two vocabularies the model shares
with the gate catalogue: the order wires cycle through their initial states, and the register
letters input gates feed. The catalogue imports them; the model never imports the catalogue.
Where the model must know what a gate does to a wire's measured state it reads
`gate.measureEffect` and `gate.isSwapHalf`, which `GateBuilder` sets.

`Registers` is the circuit's named groups of wires - contiguous, non-overlapping, uniquely
named. A register names its wires, can label its values (so a=A reads where a=0 would), and can
feed an input letter to every column that has no input gate of its own; how its wires start is a
prepare box on them, a gate in the catalogue
(`src/gates/prepare/PrepareGates.js`), which `Gate.knownPreparation` declares to the model.
`registerLabels` is the one place a wire or a basis state is written for display (`a₀`,
`a=6, b=3`), so the canvas and the panels agree; without registers it writes `q3` and bit
strings, as before.

## Serialization

JSON conversion lives in `src/serialization/Serializer.js`: it resolves gate ids against the
catalogue, so it sits above this directory rather than inside it.

## Simulation

Simulation moved to `src/engine/simulation/`, next to the math and WebGL code it depends on, so
that every calculation lives under one namespace. See `src/engine/README.md`.

## References and tests

Import the owning file directly. `CircuitDefinition` delegates execution to
`engine/simulation/CircuitExecution`, which is one of the three mutual imports CONTRIBUTING
lists; nothing else here reaches upward.

`test/circuit/` mirrors this hierarchy for the existing unit tests. The recursive test discovery
includes these subdirectories. Run `npm test`, `npm run test:e2e` and `npm run test:perf` from the
repository root to check the models, application integration and the existing performance cases.
