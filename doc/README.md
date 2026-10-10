# Quirk-Bench Manual

**Basic Actions**

- **add gate**: `drag` gate from toolbox to circuit
- **move gate**: `drag` gate in circuit
- **remove gate**: `drag` gate out of circuit **OR** `middle-click` gate **OR** choose Delete in
  its menu
- **undo**: `⌘ + Z` on a Mac, `ctrl + Z` elsewhere **OR** click 'undo' button
- **redo**: `⇧ + ⌘ + Z` on a Mac, `ctrl + shift + Z` or `ctrl + Y` elsewhere **OR** click 'redo'
  button
- **save circuit**: bookmark the page with your browser; the browser also remembers the last
  circuit, and the bare page opens on it
- **load circuit**: open the bookmark
- **open a gate's menu**: `right-click` it **OR** touch and hold it; on a wire label the same opens
  the label's menu, and inside the selection the selection's
- **add qubit**: `drag` gate onto extra wire that appears while dragging
- **remove qubit**: re-arrange gates so that the bottom wire is unused
- **show intermediate state**: `drag` a display gate onto the circuit
- **view tips**: `hover` with mouse **OR** touch and hold
- **step through the circuit**: the transport under the toolbar has two lanes. **Steps** walks
  the playhead through the columns: Play steps plays and pauses, Reset goes back to the start,
  Prev and Next step, the slider scrubs, and Breakpoint marks the column the playhead stands
  before. The playhead rests at the end, where the outputs at the right show the whole circuit's
  result, and stays there as the circuit is edited. Short of the end, the columns not yet run
  stand back under a veil and the outputs show the state reached there - at the start, the state
  the circuit starts in. Stepping never moves t
- **record a snapshot**: Record, at the end of the Steps lane, keeps this step - the state at the
  playhead - or every step from the start to the end, in Recordings
- **pause what moves**: `space` pauses whatever is moving - the steps, t, or both - and the next
  `space` brings it back; with nothing moving, it plays the steps
- **watch or stop time**: time-dependent powers, counting and formula gates follow t, which runs through its
  cycle every 8 s. **Time**, the lane below, plays and pauses t, scrubs it and nudges it 1/32 at a
  time, and says what holds it when something does - a recording or a restored snapshot. With the
  system's Reduce Motion on, t starts paused. Without a gate that uses t, the lane says so
- **change the speed**: each lane ends in its own speed, from 0.25× to 4×: Steps' paces Play and
  Time's paces t's cycle; each choice says the pace it makes, and the browser keeps both
- **zoom the circuit**: use the `−` / `+` / `Fit` buttons over the circuit's corner
- **scroll a big circuit**: drag the viewport box on the minimap that appears when the circuit
  overflows
- **inspect a qubit's Bloch sphere**: click any Bloch sphere in the circuit or at a wire's end to
  open the Bloch sphere analyzer, named for the wire as the canvas names it (q0, or by its
  register). A wire's end follows the playhead, as the canvas's outputs do: at the end it is the
  whole circuit's result, and stepping or Reset moves it; a Bloch gate keeps its own column. The
  State source - the steps, the presets and the θ and ϕ controls - comes first, with the readout's
  Bloch vector and Quantum state beside it, and the figures under it. The figures show the qubit
  three ways: the sphere seen from above the equator (drag it, or focus it and use the arrow keys;
  Reset view or Home turns it back), the meridian through the state, where θ is measured, and the
  equator, where ϕ is. All three draw one unit circle, at one size and one height, so a length
  reads the same in each. The two sections are drawn face on, with ticks, the vector's shadow as
  an arrow, its two components dashed and its length at the tip, named: |r| on the meridian,
  |r| sin θ on the equator. What the figures draw - the axis key and the Show switches - sits
  under them. Turning θ or ϕ keeps the qubit's length, so a mixed qubit stays as mixed. Escape
  closes the analyzer
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

**Using the keyboard**

- **reach the circuit**: `tab` to it; a ring marks the cell the keyboard is on, and a screen
  reader names the cell and the gate in it
- **move between cells**: the arrow keys; `home` and `end` go to the first column and to the empty
  one after the last
- **select**: `shift` with the arrow keys, from the cell where the run started
- **open a gate**: `return` does what a click does - opens its parameter, Bloch sphere or values -
  or opens its menu; `shift + F10` or the menu key opens its menu
- **place a gate**: choose it in Gates with the arrow keys and press `return`; it lands in the
  keyboard's cell
- **copy, cut or delete the gate in the cell**: `⌘/ctrl + C`, `⌘/ctrl + X` or `delete` with
  nothing selected

**Advanced Actions**

- **copy gate**: hold `option` (`alt`) while dropping a gate dragged in the circuit; let go of it
  before dropping and the gate moves
- **grab a gate's inverse**: `shift + drag` gate
- **move column**: `⌘/ctrl + drag` in circuit
- **copy column**: `⌘/ctrl + drag`, holding `option` (`alt`) at the drop
- **select part of the circuit**: `drag` from an empty part of the circuit, or touch and hold
  there first with a finger; the box grows to take in every gate it touches. `ctrl/⌘ + A` selects every gate; `Esc` or a click on an empty part lets
  the selection go, and so does any edit
- **copy, cut or delete a selection**: `ctrl/⌘ + C`, `ctrl/⌘ + X` or `Delete`, or the bar over the
  selection, or its menu. The copy is circuit JSON, the form URLs and
  Export use, so it pastes into another tab. The bar names a control, swap half or input outside
  the selection that its gates rely on - a copy leaves those behind - and offers to take their
  wires in
- **paste**: `ctrl/⌘ + V` inserts the copied gates as new columns, before the column under the
  keyboard's cell or the pointer and from the wire under it, or else after the selection or the
  circuit; nothing is
  overwritten, and the pasted gates are selected. Exported circuit JSON pastes the same way
- **create a gate from a selection**: the bar's wand opens Create gate's Circuit tab with its columns and
  wires filled in
- **set a gate's parameter**: click the 'change' button on a parametrized gate (the Rx/Ry/Rz
  rotation gates take their angle in radians)
- **fold a toolbox group**: click the group's heading; the folding is remembered
- **switch gates off and on**: Deactivate in a gate's menu or on the selection's bar
- **create custom gate**: click 'Create gate' button
- **remove custom gate**: [crummy support] have to use undo or clear all or manually edit URL

**Constructing custom gates**

Open **Create gate**, choose Rotation, Matrix, or Circuit, and inspect the operation and gate
preview. Drafts survive switching methods. **Create gate** adds the gate to Custom Gates and
focuses it; press Enter to place it in the keyboard's cell, or on the top wire, or drag it into
the circuit.

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
