---
target: the canvas, each gate as it is visualised
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 5
target_identity: "file:/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/editor/rendering"
timestamp: 2026-10-01T18-31-01Z
slug: src-editor-rendering
---
Method: dual-agent (A: three Sonnet design reviewers - whole canvas and transport, gates part one, gates part two · B: one Sonnet detector and in-app-browser agent)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Clear readouts; stepping changes nothing on the canvas and run columns look unrun |
| 2 | Match System / Real World | 3 | Right notation; the title counts gates ("5 ops") where the transport counts columns |
| 3 | User Control and Freedom | 3 | Undo/redo, Esc, Reset; two near-identical trash icons |
| 4 | Consistency and Standards | 2 | Two "Play" buttons with Space driving the wrong one; filled REC pills among ghost buttons; opposite dial handedness |
| 5 | Error Prevention | 3 | Selection names left-behind controls; assertions halt runs |
| 6 | Recognition Rather Than Recall | 2 | 14 icon-only toolbar buttons; truncated palette labels; wire labels scroll away |
| 7 | Flexibility and Efficiency | 3 | Keyboard cells, shift-select, menus; no keys for Prev, Next, Reset |
| 8 | Aesthetic and Minimalist Design | 2 | Every wire carries Chance + Bloch + |r| + grid cell; the idle Time lane keeps a full row |
| 9 | Error Recovery | 3 | "Add input A" and plain-language reasons |
| 10 | Help and Documentation | 2 | One 13px muted line; nothing explains Steps vs Time or REC |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict
- LLM: mostly authored. One hue per axis now runs from gate tiles through dial arcs and controls to the Bloch axes; the playhead bracket and the transport's lane marks tie chrome to canvas; doubled classical wires. The shell (icon toolbar, dock tabs) stays stock.
- Deterministic: CLI 0 findings over 206 files; browser overlay 1 finding (layout-transition) from third-party dockview drag CSS, a false positive for the canvas. No runtime errors.

## Priority Issues
1. [P1] Space and Play mislead. Space toggles the Steps lane (transport-bar.jsx:49-52) while t is what moves; both lanes' buttons read "Play" (transport-bar.jsx:145, time-lane.jsx:126). Fix: Space pauses what moves, names "Play steps" / "Play t". → /impeccable clarify
2. [P1] First run has no path. The hint is 13px muted near the top (cursor.css:19-35), Examples is an unlabeled icon, and the palette opens on Probes; H, X, Z arrive fifth (AllGates.js:279). → /impeccable onboard
3. [P1] Stepping has no visible consequence on the canvas: it keeps the whole circuit's result by design (redrawLoop.js:105), and columns already run look like unrun ones. → /impeccable animate
4. [P1] Dials disagree. The wire dial sweeps clockwise (wire-dial.css:36 conic-gradient) while time dials and the t clock sweep anticlockwise (TimeDial.js:33, cycleDial.js); Y/Z time dials squash the face, bending the angle being read; sectors ignore the axis hue; dial arcs on the cream face fail 3:1 (Z 1.15, Y 1.71). → /impeccable polish
5. [P1] Labels collide or mislead: =ψ draws "✗" over "edit" (AssertionGates.js:27, GateFrame.js:172); a firing detector rotates bold "*click*" over its wedge (Detector.js:212-250); staircase names sit unbacked on step lines with ↡/↟ at about 8px (CountingGates.js); X^ft prints "pi t^2" while Rx prints π. → /impeccable typeset

## Persona Red Flags
- Alex: Space drives the wrong lane; t autoplays on load; no keys for Prev/Next/Reset; REC's 600ms hold is hidden; zoom capped at 150% in steps.
- Sam: canvas is about the 22nd tab stop with no skip link; #playhead-position has no aria-live and the steps scrubber no aria-valuetext, so Next announces nothing; the keyboard cell ring is pale grey inside the amber bracket.
- Jordan: unlabeled Examples; palette opens on Postselect and Anti-Control; two identical Play buttons; "operation", "REC", "|r|" and "ring = log chance" unexplained.

## Minor Observations
- Arithmetic shows no values: input tiles and targets never say "A = 1"; learners decode binary from per-bit readouts.
- Input links are 1.14:1 against the wire; their letters render near 7px; input tiles are square and 1.01:1 against the canvas.
- Chance end blocks are about 70px against 100px middle blocks, so the same data prints at different sizes.
- The disabled-gate veil leaves a ghost of the gate's own label under "Add inputs A, R".
- The idle Time lane keeps a live speed menu that controls nothing; REC pills are the only filled controls.
- Phone: a saved desktop dock layout keeps the palette docked at 375px; transport targets are 32-36px; wire labels are not pinned on scroll.
- Amps cells encode chance three times (disc, ring, bar); disc vs bar 1.94:1 dark, 1.27:1 light; Density1 has no labels.
- Permutation routes are bright hairlines that leave residue; <<3 and >>3 are mirror images without a name; rev2 is still a tile.
- "omits 75%" / "kept: 25%" statistics are in error magenta; the 0 gate is 2.0:1; NeGate is a bare dash; parity boxes carry no axis hue; postselect tiles are square and outline-less.

## Questions to Consider
- Should Steps live on the circuit as a ruler (column numbers, breakpoints) and leave only Play and Time in the chrome?
- Is the canvas for the final answer or the running state?
- Must every circuit open with Chance, Bloch and grid already on?
