**Basic Actions**

- **add gate**: `drag` gate from toolbox to circuit
- **move gate**: `drag` gate in circuit
- **remove gate**: `drag` gate out of circuit **OR** `middle-click` gate
- **undo**: `ctrl + Z` **OR** click 'undo' button
- **redo**: `ctrl + shift + Z` **OR** `ctrl + Y` **OR** click 'redo' button
- **save circuit**: bookmark the page with your browser
- **load circuit**: open the bookmark
- **add qubit**: `drag` gate onto extra wire that appears while dragging
- **remove qubit**: re-arrange gates so that the bottom wire is unused
- **show intermediate state**: `drag` a display gate onto the circuit
- **view tips**: `hover` with mouse **OR** awkwardly tap-hold with finger
- **play/pause the animation**: `space` **OR** click the transport's play button
- **zoom the circuit**: use the `−` / `+` / `Fit` buttons over the circuit's corner
- **scroll a big circuit**: drag the viewport box on the minimap that appears when the circuit
  overflows
- **inspect a qubit's Bloch sphere**: click any Bloch sphere in the circuit or at a wire's end to
  open the Bloch Sphere Analyzer. Its parts are grouped by what they do: Figures, Display, State
  source, and beside them the readout's Bloch vector and Quantum state. The figures show the qubit
  three ways: the sphere in perspective (drag to rotate), the meridian through the state, where θ
  is measured, and the equator, where ϕ is. All three draw one unit circle, at one size and one
  height, so a length reads the same in each. The two sections are drawn face on, with ticks, the
  vector's shadow as an arrow, its two components dashed and its length at the tip. The Bloch
  vector group lists the state vector (|r|, θ, ϕ), the Cartesian components with the formula each
  comes from, and the quaternion q that turns |0⟩ onto the state; the Quantum state group lists the
  amplitudes α and β, the purity Tr ρ² and the ket
- **read what is and is not defined**: a maximally mixed qubit has no direction, so θ, ϕ, q and
  every formula read —; on the z axis only ϕ is undefined. A note says which, and — is always
  muted so it never passes for a zero
- **read one axis at a time**: hover an axis in the colour key to fade the others, click it to keep
  it there, and use **Show** to draw only the constructions you are asking about
- **step through the circuit**: the strip under the figures holds the qubit after every column;
  click a step, or use ← and →, to read that state
- **explore without a circuit**: the presets |0⟩ … |−i⟩ and Mixed, and the θ and ϕ sliders, put a
  free state in the analyzer, marked as not from the circuit; **Back to circuit** returns
- **open the gates on a narrow screen**: click the `Gates` button over the circuit's corner; the
  palette slides in as a drawer and closes when a gate is dragged out

**Advanced Actions**

- **copy gate**: `shift + drag` gate in circuit
- **grab a gate's inverse**: `alt + drag` gate
- **move column**: `ctrl + drag` in circuit
- **copy column**: `ctrl + shift + drag` in circuit
- **set a gate's parameter**: click the 'change' button on a parametrized gate (the Rx/Ry/Rz
  rotation gates take their angle in radians)
- **fold a toolbox group**: click the group's heading; the folding is remembered
- **create custom gate**: click 'Make Gate' button
- **remove custom gate**: [crummy support] have to use undo or clear all or manually edit URL

**Constructing custom gates**

Open **Make Gate**, choose Rotation, Matrix, or Circuit, and inspect the operation and gate
preview. Drafts survive switching methods. **Create gate** adds the gate to Custom Gates and
focuses it; press Enter to place it on the top wire, or drag it into the circuit.

- **Rotation:** choose Y, enter `pi/3` in radians, and leave global phase at `0` for a
  60-degree Y rotation. Switching radians/degrees converts the value. Global phase changes
  the operator but does not change the Bloch rotation.
- **Matrix:** edit a 2×2, 4×4, 8×8, or 16×16 grid, or choose Raw text. For example,
  `1, 0, 0, 2` creates the entered nonunitary operation. **Make unitary** offers a comparison;
  only **Use corrected matrix** selects the correction. Editing an entry clears that choice.
- **Circuit:** enter one-based inclusive column and wire ranges, such as `1:3` and `1:1`.
  `1:∞` includes the whole range. The highlighted selection must include every intersecting
  gate in full; the preview shows the circuit that will become the custom gate.

Use **Gate Parameter** to choose an existing parameter gate by wire and column, or click its
edit indicator. Invalid angles cannot be applied. **Math input** provides optional mathematical
notation and an explicit keyboard; **Raw expression** remains available. Unsupported notation
is reported locally. Typing undo stays in the input; Cancel preserves the circuit. Created
matrix and circuit gates retain their operation, not an editable construction draft.

**Reading operation matrices**

Open Algebra to follow each operation as its matrix times the expanded input state, alongside
the simulated output state. Cards share their dimensions and basis-state row spacing. Matrices
through 8×8 use written entries; larger operators use zoomable plots. Rows identify output basis
states and columns identify input basis states. Hover a written entry for its basis labels.

Scroll the operation sequence horizontally with a trackpad, Shift+wheel or the keyboard. A plain
wheel scrolls the panel vertically. Wide equations remain intact; resize the Algebra panel for
more space. In a plotted operator, use zoom buttons or Ctrl+wheel, drag or arrow keys to pan, and
the Output row / Input column fields to inspect a numerical entry with the keyboard.

An arrow without a matrix represents simulated states for an operation with no matrix
representation. A mismatch is marked ≠; unchecked large products are not claimed equal. After
deferred measurement, the kets are internal simulation amplitudes: density matrices describe
the physical mixed state. An amplitude grid is a reshaped state vector, not an operator.

**Conventions**

- Coordinates
  - Right-handed
  - X is +right/-left
  - Y is +forward/-backward
  - Z is +up/-down
- Ordering
  - Top wire is the low bit. Bottom wire is the high bit.
  - Kets are big-endian. |00101⟩ is 5, not 20.
  - Listed/grided values are in ascending row-major order from top left to bottom right.
- Colors
  - Blue: amplitudes
  - Green: probabilities / densities
  - Yellow: change / varying
  - Orange: focused
  - Magenta: error / attention
  - Pink / aqua / sky blue: the Bloch x / y / z axes — their letters, their readout names and the
    triangles that measure each component, kept apart from the amplitude blue
