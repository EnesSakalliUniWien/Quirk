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
  drag the enlarged sphere to rotate the view

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
