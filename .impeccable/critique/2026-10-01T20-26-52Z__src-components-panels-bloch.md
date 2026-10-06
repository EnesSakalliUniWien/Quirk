---
target: the Bloch sphere viewer
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/bloch"
timestamp: 2026-10-01T20-26-52Z
slug: src-components-panels-bloch
---
Method: dual-agent (A: two Sonnet design reviewers - panel and controls, figures and canvas agreement · B: one Sonnet detector and in-app-browser agent)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The analyzer ignores the playhead (Reset: canvas "at the start", panel "final output state"); no announcement of changing values |
| 2 | Match System / Real World | 2 | "State vector" labels |r| θ ϕ; Tr ρ², Quaternion, cos · sin unexplained |
| 3 | User Control and Freedom | 2 | Back to circuit works; Esc does not close; no reset for a rotated sphere; Close drops focus to the body |
| 4 | Consistency and Standards | 2 | q0 vs "Qubit 1"; |i⟩ vs |+i⟩; green badge is |r| on the meridian, |r| sin θ on the equator |
| 5 | Error Prevention | 2 | ϕ accepts and discards input at a pole; dragging θ on a mixed qubit silently makes it pure |
| 6 | Recognition Rather Than Recall | 3 | Everything visible; the axis key doubles as a pin, said only by a title |
| 7 | Flexibility and Efficiency | 2 | No |r| or amplitude entry, no copy, pointer-only rotation |
| 8 | Aesthetic and Minimalist Design | 2 | θ/ϕ ~7 times; the maximally-mixed note 3-4 times |
| 9 | Error Recovery | 3 | Honest "—" and notes at poles and mixed states; typed 999 stays in the field |
| 10 | Help and Documentation | 2 | No plain-language θ/ϕ/entangled; cos · sin footnote always on |
| **Total** | | **22/40** | **Acceptable** |

## Design Specificity Verdict
- LLM: the figures are authored for teaching this physics (axis-coloured triangles with right-angle marks, meridian turned by ϕ so θ is a true angle, great-circle glide, one painter for glyph, strip and analyzer, "—" with notes for undefined angles); the frame is generic (identical bordered cards with builder-voice purposes, an 8-checkbox options row, graphing-calculator ticks).
- Deterministic: CLI 0 findings in src/components/panels/bloch and src/draw/displays/bloch (also with --no-config); overlay 11 findings, 1 real (x-axis label 4.0:1, and the legend button 3.99:1 the detector missed); the rest false positives from dockview CSS and the floating window over the sidebar.

## Priority Issues
1. [P1] The readout is ~800px below the controls: floating window 1180 wide (panels.jsx:110) but the side-by-side layout needs a 1280 container (bloch.css:40); switches start ~130px below the fold at 1440×900; the window covers the circuit at 1024. Pin a compact readout beside State source, lower the breakpoint to ~1000, move switches onto Figures. → /impeccable layout
2. [P1] Sphere seen from below and vertical drag inverted (projectPoint BlochScene.js:28-40, DEFAULT_VIEW :280; useBlochFigures.js:260-266); no reset view; labels crowd the tip (arrowhead on the x head, white θ/ϕ arcs crossing, cos · sin over |+⟩); canvas glyphs share the view. Flip the pitch sign, add Reset view, push labels off the tip. → /impeccable polish
3. [P1] Ignores the playhead (completed.fullStats via useCircuitSteps) and names q0 "Qubit 1" (analyzerModel.js:143; wireLabel exists). Follow the playhead in circuit mode and name the wire with wireLabel(). → /impeccable clarify
4. [P1] Keyboard and screen reader: focus stays on the canvas (21st Tab stop), no Esc, Close drops focus, no live region, drag-only rotation, static canvas aria-labels, slider and field share a name, steps named "in"/"H"/"T". → /impeccable harden
5. [P2] Mixed/undefined/edge values misreported: sliders at 0 and enabled in Mixed; ϕ input dropped at a pole; drag silently purifies; 999 stays; ϕ "360.0°" for T·T† (analyzerModel.js:177, wrap before round); unlabelled 0.707 badge; negative ρ ticks. → /impeccable harden, /impeccable clarify

## Persona Red Flags
- Alex: no |r|/amplitude entry, switches and pinned axis reset on reopen, hover-only exact values, no snap-to-axis, window hides the circuit.
- Sam: issue 4, plus 7 preset Tab stops, slider+field double stops, clipped step focus ring (bloch.css:362).
- Jordan: unexplained jargon, Bell pair all dashes plus a repeated sentence, |0⟩ drawn as the far pole, 0.707 beside a unit arrow, "← → to step" on touch, q0 called Qubit 1.

## Minor Observations
- Opening flash: 30-60 ms laid out at 100px (container sized before the group), then blank → blurry → sharp canvases over ~0.4 s.
- x-axis blue 3.99:1 on dark, z 4.09:1 on light; axis buttons 34×22, checkboxes 16px.
- A panel opened on desktop keeps 992px when the window shrinks to a phone.
- Back to circuit inserts a 26px layout jump.
- |1⟩ preset ket "0.000 |0⟩ + (+1.000+0.000i) |1⟩"; caption "XZ turned by ϕ · θ"; tab title repeats the h2.
- Animated circuits update the figures at ~9 fps in 5° jumps.
- Docs call the orthographic sphere "perspective".

## Questions to Consider
- Should the readout live beside the slider?
- Is Explore a lens on the circuit or a separate lab?
- Should the sphere draw the meridian wedge and equator ring so the other figures read as its cross-sections?
