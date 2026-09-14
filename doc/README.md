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
- **inspect a qubit's Bloch sphere**: click any Bloch sphere in the circuit or at a wire's end;
  drag the enlarged sphere to rotate the view. A triangle in an axis's colour drops the vector
  along that axis, its coloured leg as long as the component; a fainter triangle in the same
  colour resolves the projection in the plane normal to that axis, and the unit circle normal to
  that axis carries the colour too. Arcs mark θ from |0⟩ and ϕ from |+⟩. The readout also writes
  the state as the unit quaternion q that turns the |0⟩ pole k onto it, with r = |r| q k q̄;
  switching **Quaternion** on draws the axis n of that turn and the path |0⟩ takes
- **read one axis at a time**: in the enlarged view, hover an axis in the colour key to fade the
  others, click it to keep it there, and use **Show** to draw only the constructions you are
  asking about
- **read a component face-on**: under the sphere, one section per axis looks straight down it at
  the plane it is normal to, and draws the shadow the vector casts there with its two components
  and its length
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
