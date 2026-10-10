---
target: the canvas, each gate as it is visualised
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 5
target_identity: "file:/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/editor/rendering"
timestamp: 2026-10-01T19-12-41Z
slug: src-editor-rendering
---
Method: dual-agent (A: three Sonnet design reviewers - whole canvas and transport, gates part one, gates part two · B: one Sonnet detector and in-app-browser agent)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Band, veil and "after operation N" are excellent; but "operation 0 / N" shows the final state |
| 2 | Match System / Real World | 3 | Domain-correct; "Half turns", "Probes", "Local wire states (Chance/Bloch)" are jargon for students |
| 3 | User Control and Freedom | 3 | Undo, Esc, Prev, Reset and Space work; REC's long-press is hidden |
| 4 | Consistency and Standards | 2 | Amber is playhead and hover ring; "Off/On" is both a 0%/100% readout and a disabled gate; probability drawn four ways |
| 5 | Error Prevention | 3 | Controls disable correctly; phone targets are 32px |
| 6 | Recognition Rather Than Recall | 2 | 13 unlabeled toolbar glyphs, "REC", a gauge that says only "1×", truncated palette names |
| 7 | Flexibility and Efficiency | 3 | Strong keyboard editing, JSON copy/paste, minimap; no keys for Next and Prev |
| 8 | Aesthetic and Minimalist Design | 2 | Three output encodings always on; an idle Time lane row; recorders heavier than Play |
| 9 | Error Recovery | 3 | Undo and breakpoints that follow edits |
| 10 | Help and Documentation | 2 | Prose hint, hover tips and the guide; 10-12px captions, nothing says which output to read first |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict
- LLM: mostly authored. Step visualisation (bracket, veil, "after operation N"), live dials, the two sequencer lanes with stated paces, one axis colour and one dial grammar across tiles, controls, dials and Bloch axes. The shell (13 icon-only buttons, ghost chrome) stays stock; the canvas never numbers operations and never draws entanglement or flow.
- Deterministic: CLI 0 findings over 204 files; browser overlay 1 finding (layout-transition) from third-party dockview drag CSS, a false positive for the canvas; no runtime errors.

## Priority Issues
1. [P1] Step 0 shows the answer. At "operation 0 / N", and after Reset or Prev back to 0, the outputs show the whole circuit's result (redrawLoop.js:110-113 follows only past step 0), so a student reads the final state as the starting one. → /impeccable clarify
2. [P1] Probability is drawn four ways and phase two ways. Chance by length, Amps by area plus a bar plus a log ring, Density by radius ∝ |ρ| (ComplexCellGeometry.js:59), the raster by opacity; phase is a white hand up to five qubits and hue from six. A reading never transfers between displays. → /impeccable clarify
3. [P1] Wire labels and |0⟩ tiles scroll away. The gutter is drawn in scene space (CircuitGutter.js:99-127), so at 125% zoom or on a wide circuit the wires lose their names. → /impeccable layout
4. [P1] The transport's weight is upside down. REC and Record whole run are the heaviest, always-enabled chips (a hidden 600ms hold records the whole run, ready-controls.jsx:19-22), Play steps is a ghost button, and the idle Time lane keeps a row and a dead 1× (time-lane.jsx:172-177). → /impeccable distill
5. [P1] Text falls below legibility. Chance blocks print at 7.7-9px, the Density key at 6.7px (DensityMatrixView.js:38), "Reverse" at 9px; the 0 gate is 2.0:1; a disabled gate's 90% veil leaves a ghost label under its reason (CircuitWarnings.js:52), which never says the input must be in the same column. → /impeccable typeset

## Persona Red Flags
- Alex: no shortcuts for Next/Prev; Reset lands on the final state; t spins while he steps; wire labels leave the screen; each speed menu takes two clicks.
- Sam: the circuit is the 17th tab stop with no skip link; disabled controls by opacity only; hover-only tooltips; output values may not reach assistive technology; nothing announces the Time lane's pause.
- Jordan: the hint sits 300px from the slot; "Open an example" leads with Grover; "Off", "On", "|r|", "REC", "t" and "Probes" unexplained; about 48 visible controls on first open.

## Minor Observations
- Time gates share no grammar: violet staircases, violet-or-grey pulses, a plain grey gradient tile, axis-filled formula tiles; the shift glyphs ↟/↡ are about 8px; the 22px name plate hides a one-wire pulse.
- The wire-dial arc is a 2px sliver with no end mark; on the light scheme Y and Z arcs are 2.8 and 2.4:1; the wire strikes through an unfilled time-dial face.
- Exponents share the base's font size, so "-1" is as large as its base and "A/2²" runs edge to edge.
- Input A's link passes behind a B or R tile; input tiles are 1.01:1 against the canvas; permutation gates are bare bright lines with no frame.
- Amps' bar corners poke out from behind the disc above 25%; the state-vector grid clips past four qubits at 1440px; Sample's caption bit order is reversed.
- Amber is both the hover ring and the playhead bracket; the light-scheme band is nearly invisible; detect-control-reset's control bulb collides with "|0⟩" and still uses the old white X/Y bulb.
- A saved desktop dock layout keeps the palette docked on a phone; transport buttons are 32px.

## Questions to Consider
- Should "run" be the default, with the transport resting at the end and results arriving as you step, rather than parking the final state at step 0?
- Should the Time lane appear only when a gate uses t?
- The output column answers three questions with three encodings at once: which should a student read first, and does the canvas say so?
