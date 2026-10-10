# Display responsibilities

Import the owning module directly. These modules draw existing scientific results; simulation
and numeric state calculations remain in `src/engine/`.

| Directory      | Responsibility                                                                           | Modules                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `bloch/`       | Bloch spheres, projections and circuit-step thumbnails                                   | `BlochScene.js`, `BlochView.js`, `BlochProjections.js`, `BlochStrip.js`, `BlochGeometry.js` |
| `complex/`     | Shared complex-cell rendering and geometry                                               | `MatrixView.js`, `MatrixCells.js`, `ComplexCellGeometry.js`                                 |
| `amplitudes/`  | Amplitude display data and captions                                                      | `AmplitudeView.js`                                                                          |
| `density/`     | Density matrices and basis labels                                                        | `DensityMatrixView.js`                                                                      |
| `probability/` | Probability readouts, their scale and grouping, and already-sampled measurement outcomes | `ProbabilityView.js`, `ProbabilityScale.js`, `ProbabilityBlocks.js`, `SampleView.js`        |

## Dependencies

- `BlochView` and `BlochStrip` use `BlochScene`; `BlochGeometry` supplies the shared axes and plot sizing.
- `DensityMatrixView` uses `MatrixView`, which lays a grid out and hands it to `MatrixCells` to draw;
  `ComplexCellGeometry` supplies the marks' sizes.
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

Density values, dividers, labels and tooltip regions share `densityGridRect`. Amplitude grids share `stateGridRect` in `../renderers/dataRenderers.js`: square cells fit inside the gate, the gate's frame follows them, and cells too small to name their basis state move those names to the grid's edges.

Every grid of complex numbers draws them one way, and in it colour means phase and nothing else. A disc's radius is its entry's magnitude and its fill is its phase's hue, from an OKLCH wheel at one lightness (`src/appearance/formats/phase.js`): +1 blue, −1 orange, +i magenta, −i green, so a sign reads at a glance, also with red-green colour blindness. The hand points along the phase, dark on its disc and light where a small amplitude's hand reaches past it; it is as long as the amplitude, ending on its disc, with a short least length, so a quarter turn reads where the hue alone may not, and its zero is a tick at the cell's right. Every other mark is a neutral ink: an amplitude's chance is a gauge up its cell's left edge, on a faint rail, keeping at least 2 units for any possible outcome; a density matrix's chance shades its diagonal; the logarithmic ring is grey. A disc whose phase is undefined wears the neutral `amplitude.unknown` and has no hand. The key under the state-vector grid draws the wheel (`paintPhaseWheel`), labelled at its quarter turns; a pixel caption on an Amps gate or density matrix draws a small one. Cells of the state-vector grid big enough to hold it print their chance in a corner, and its tooltip leads with the chance. Only the phases between amplitudes are physical, so the state-vector grid and every Amps gate measure them from the largest amplitude, the first of any that tie (src/engine/math/phaseReference.js), and say which: the grid in its key, as the wheel's 0°, a gate in its caption. The grid's key also says how a cell's ket is read: the row's bits, then the column's, naming the wires each holds. Below 12 units per cell, logarithmic rings are omitted; past five qubits and below 16 units, the shared raster algorithm replaces marks and dividers, the hue alone carries the phase, and a density matrix outlines its diagonal. Raster opacity is magnitude relative to the matrix's largest entry, with a visibility floor, so the complex-values panel reports full stored values. For assistive technology the state-vector grid is also put in words (`describeOutputState` in `src/editor/rendering/outputs/CircuitOutputState.js`): its likeliest outcomes, with their chances and phases.

`MatrixCells` draws a grid the way Pixi draws many small marks that change every frame. Each mark - disc, ring, bar, hand, tick, label plate - is a `Particle` in one `ParticleContainer`, cut from a shared white texture and given its position, size, angle and tint as numbers, so a changed value moves particles and re-triangulates nothing. The ground and grid lines are a `Graphics` redrawn only when the layout or the theme changes; a raster grid is one `Sprite` over a `BufferImageSource` uploaded from the raster; chance labels are pooled `BitmapText` in a bitmap font installed once. The same numbers draw nothing again.

On the canvas a probability bar's length is its chance, as a one-wire Chance tile's is, so half a bar is 50% in every display. (The Probabilities panel keeps its own square-root scale, which it explains beside its table.) A probability at or below `ZERO_PROBABILITY` (1e-9, above single-precision round-off) reads 0% or Off. A smaller chance that still rounds away reads "<0.1%" or ">99.9%", and a possible outcome keeps at least a pixel of bar. Labels sit on a darker bar colour, `probability.bar`, which white text reads on without a plate.

Rows stay in index order, and the key under a Chance display names the bit order (bits q3q2q1q0). When the outcomes of adjacent wires are independent of the rest (`ProbabilityBlocks`, to within 1e-6), each block of wires draws its own distribution beside those wires, parted from the next by a dashed rule: the outcomes are independent, which says nothing about whether the states are separable. A circuit that animates keeps the joint distribution, so passing through independence never flashes blocks. A row's ket and percentage are never drawn below 10px: a row too short for them carries its bar alone, and a gate too narrow for ">99.9%" drops the decimal. Rows too thin for their kets group by leading bits: a divider every 2, 4, 8… rows, the fewest that stay 24 units tall, and on the canvas the group's prefix (01⋯) left of the gate. Rows at least 4 units tall get their own bar and divider; thinner rows draw one outline per group.

Click amplitude or density gates to open `components/panels/complex-display/`. This panel owns cell selection and the enlarged phase readout; arrow keys and numeric row/column inputs support keyboard use. It follows completed simulation results and does not edit the circuit.
