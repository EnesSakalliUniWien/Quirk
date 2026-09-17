# Display responsibilities

Import the owning module directly. These modules draw existing scientific results; simulation
and numeric state calculations remain in `src/engine/`.

| Directory | Responsibility | Modules |
| --- | --- | --- |
| `bloch/` | Bloch spheres, projections and circuit-step thumbnails | `BlochScene.js`, `BlochView.js`, `BlochProjections.js`, `BlochStrip.js`, `BlochGeometry.js` |
| `complex/` | Shared complex-cell rendering and geometry | `MatrixView.js`, `ComplexCellGeometry.js` |
| `amplitudes/` | Amplitude display data and captions | `AmplitudeView.js` |
| `density/` | Density matrices and basis labels | `DensityMatrixView.js` |
| `probability/` | Probability readouts, their scale and grouping, and already-sampled measurement outcomes | `ProbabilityView.js`, `ProbabilityScale.js`, `ProbabilityBlocks.js`, `SampleView.js` |

## Dependencies

- `BlochView` and `BlochStrip` use `BlochScene`; `BlochGeometry` supplies the shared axes and plot sizing.
- `DensityMatrixView` uses the retained `MatrixView`; `ComplexCellGeometry` supplies shared cell marks.
  `AmplitudeView` supplies amplitude data and captions to the shared state renderer.
- `ProbabilityView` supplies multi-qubit data to the shared probability renderer and draws
  single-probability boxes. `SampleView` reads outcomes already selected during simulation.
- `ProbabilityScale` has no imports. The probability renderer, the Probabilities panel and the
  tape's distributions share its percentage text, its bar length and its zero.
- Shared data renderers remain in `../renderers/`. Generic shape primitives, text, tooltips,
  scenes and surfaces remain in their existing sibling directories.

Tests mirror these groups under `test/draw/displays/`.

Bloch views share `PURE_STATE_THRESHOLD` from `src/engine/math/bloch.js`. A repaint computes
one `blochReading` for its vector and passes it through the sphere, projections and readout.
Standalone drawing calls compute their own reading when none is supplied. Readings are local
to the repaint so state changes cannot reuse an earlier vector's angles or purity.

Density values, dividers, labels and tooltip regions share `densityGridRect`. Amplitude grids share `stateGridRect` in `../renderers/dataRenderers.js`: square cells fit inside the gate, the gate's frame follows them, and cells too small to name their basis state move those names to the grid's edges. Below 12 units per cell, logarithmic rings are omitted; past five qubits and below 16 units, the shared raster algorithm replaces marks and dividers, captions show a phase key, and a density matrix outlines its diagonal. Raster opacity is magnitude relative to the matrix's largest entry, with a visibility floor, so the complex-values panel reports full stored values.

A probability bar's full length is the largest probability it is drawn with, and each bar is the square root of its share of that, as an amplitude disc's radius is. The Chance display names that largest value under the gate; overlaid tape distributions pass one shared value. A probability at or below `ZERO_PROBABILITY` (1e-9, above single-precision round-off) reads 0% or Off. A smaller chance that still rounds away reads "<0.1%" or ">99.9%", and a possible outcome keeps at least a pixel of bar. Labels sit on a darker bar colour, `probability.bar`, which white text reads on without a plate.

Rows stay in index order, and the key under a Chance display names the bit order (bits q3q2q1q0). When the outcomes of adjacent wires are independent of the rest (`ProbabilityBlocks`, to within 1e-6), each block of wires draws its own distribution beside those wires, with a ⊗ between blocks and one bar scale for all of them. A circuit that animates keeps the joint distribution, so passing through independence never flashes blocks. Rows too thin for their kets group by leading bits: a divider every 2, 4, 8… rows, the fewest that stay 24 units tall, and on the canvas the group's prefix (01⋯) left of the gate. Rows at least 4 units tall get their own bar and divider; thinner rows draw one outline per group.

Click amplitude or density gates to open `components/panels/complex-display/`. This panel owns cell selection and the enlarged phase readout; arrow keys and numeric row/column inputs support keyboard use. It follows completed simulation results and does not edit the circuit.
