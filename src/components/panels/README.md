# Panels

`panels.jsx` registers the dock panels. Each panel has a directory named after its
registry key and an entry component in `<name>-panel.jsx`. Each supporting React
component has its own file, using the existing kebab-case naming convention.

| Directory | Responsibility |
| --- | --- |
| `algebra/` | Operation equations, step cards, state factors and evolution chart |
| `bloch/` | Enlarged Bloch sphere and its readings |
| `circuit/` | Circuit canvas host, gutter rename box and gutter menu |
| `export/` | Circuit and simulation exports, including copy feedback |
| `forge/` | Custom gate creation from matrices, rotations and circuit ranges |
| `gate-param/` | Editing a selected gate's parameter |
| `gates/` | Gate toolbox panel |
| `probabilities/` | Playhead basis-state probabilities |
| `qubits/` | Per-qubit readings |
| `registers/` | Register editing, value labels and readings |
| `state/` | Playhead state table |
| `tape/` | Recorded takes, comparison, import/export and recording controls |
| `shared/` | Completed-result subscription and dock wrapper used across panels |

Keep panel-specific hooks and helpers with their panel. The circuit's gutter
editors live in `circuit/` because they are positioned and mounted by the circuit
host. Recording controls live in `tape/` and are also used by the transport bar.

Shared matrix renderers remain in `src/components/math/`, shared gate details in
`src/components/gate/`, and toolbox components in `src/components/toolbox/`.
Simulation and saved-result logic remain in their existing engine and results
directories. Styles remain in `src/styles/`.

To add a panel, create its directory and component, then register it in
`panels.jsx`. Keep registry keys stable: Dockview persists those keys in layouts.
