# Display responsibilities

Import the owning module directly. These modules draw existing scientific results; simulation
and numeric state calculations remain in `src/engine/`.

| Directory | Responsibility | Modules |
| --- | --- | --- |
| `bloch/` | Bloch spheres, projections and circuit-step thumbnails | `BlochScene.js`, `BlochView.js`, `BlochProjections.js`, `BlochStrip.js`, `BlochGeometry.js` |
| `complex/` | Shared complex-cell rendering and geometry | `MatrixView.js`, `ComplexCellGeometry.js` |
| `amplitudes/` | Amplitude display data and captions | `AmplitudeView.js` |
| `density/` | Density matrices and basis labels | `DensityMatrixView.js` |
| `probability/` | Probability readouts and already-sampled measurement outcomes | `ProbabilityView.js`, `SampleView.js` |

## Dependencies

- `BlochView` and `BlochStrip` use `BlochScene`; `BlochGeometry` supplies the shared axes and plot sizing.
- `DensityMatrixView` uses the retained `MatrixView`; `ComplexCellGeometry` supplies shared cell marks.
  `AmplitudeView` supplies amplitude data and captions to the shared state renderer.
- `ProbabilityView` supplies multi-qubit data to the shared probability renderer and draws
  single-probability boxes. `SampleView` reads outcomes already selected during simulation.
- Shared data renderers remain in `../renderers/`. Generic shape primitives, text, tooltips,
  scenes and surfaces remain in their existing sibling directories.

Tests mirror these groups under `test/draw/displays/`.

Bloch views share `PURE_STATE_THRESHOLD` from `src/engine/math/bloch.js`. A repaint computes
one `blochReading` for its vector and passes it through the sphere, projections and readout.
Standalone drawing calls compute their own reading when none is supplied. Readings are local
to the repaint so state changes cannot reuse an earlier vector's angles or purity.

Density values, dividers, labels and tooltip regions share `densityGridRect`. Below 24 units per cell, logarithmic rings are omitted; below 10, the shared raster algorithm replaces marks and dividers. Its magnitude opacity has a visibility floor, so the complex-values panel reports full stored values.

Click amplitude or density gates to open `components/panels/complex-display/`. This panel owns cell selection and the enlarged phase readout; arrow keys and numeric row/column inputs support keyboard use. It follows completed simulation results and does not edit the circuit.
