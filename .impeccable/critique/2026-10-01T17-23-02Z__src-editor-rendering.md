---
target: the canvas, each gate as it is visualised
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 4
target_identity: "file:/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/editor/rendering"
timestamp: 2026-10-01T17-23-02Z
slug: src-editor-rendering
---
Method: dual-agent (A: six Sonnet design reviewers, one per gate family plus the whole canvas · B: one Sonnet detector and in-app-browser agent)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | The playhead band is the same brown as hover, and nothing scrolls the canvas to the band |
| 2 | Match System / Real World | 2 | "\|r\| 1.000", "Chance", "00…" grid labels, "operation" in the transport vs "column" on the canvas |
| 3 | User Control and Freedom | 3 | Undo/redo, Esc and a non-destructive "off" switch |
| 4 | Consistency and Standards | 3 | Amber means hover, playhead, focus and button; magenta means error, parity and post-select |
| 5 | Error Prevention | 3 | Inline disabled reasons and the selection's dependency warning |
| 6 | Recognition Rather Than Recall | 2 | The output key is 10px; assertion tiles all read "asser…"; drop modifiers are invisible |
| 7 | Flexibility and Efficiency | 3 | Full keyboard cursor, Shift-select, minimap and Fit, little of it discoverable |
| 8 | Aesthetic and Minimalist Design | 2 | 112px wire pitch and a wide output column, so little circuit fits on screen |
| 9 | Error Recovery | 3 | Plain-language "omits 50%" and disabled reasons, but no remedy for a missing input |
| 10 | Help and Documentation | 2 | One muted sentence; the Examples book is icon-only |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict
- LLM: mostly authored for a quantum-circuit tool, with generic edges. Strengths: gate-family hues, the control grammar, Measure's dial, the register braces and the readout trio. Generic or timid: a stock dark chrome; amber and magenta doing too many jobs; wires that carry no state; an anonymous empty state.
- Deterministic scan: CLI `detect` over src/components, src/editor and src/app gave 0 findings (the entrypoint was verified on a bad fixture). The browser overlay gave 1 finding (layout-transition), which comes from the third-party dockview drag CSS: a false positive for the canvas. A DOM detector cannot see the Pixi canvas, so the visual review carries this critique.

## Priority Issues
1. [P0] Wide gates overlap their neighbours on every loaded circuit. withWidthOverlapsFixed runs only after an edit (CircuitEditing.js:155); URL, example and JSON loads skip it (serialization/circuits/text.js:22, url.js:140). Amps3, Density2 and Density3 are drawn over, and the "Two State Model Unitary from Eigenvalues" example (exampleCircuits.js:400-433) is garbled by the 3-column rotations. Fix: normalise widths on load and pad the example. → /impeccable harden
2. [P1] Colour carries too many meanings, and axes have three palettes. Amber is hover + playhead + focus + buttons; magenta is error + parity + post-select + trash. X/Y/Z are blue/pink/pale on gates, blue/green/orange on dials, pink/teal/azure on Bloch. Dark Bloch Y and Z are both cyan. Fix: give the playhead its own hue, keep magenta for errors, use one axis palette. → /impeccable colorize
3. [P1] The time dials disagree with each other and with the clock. Z-axis dials start at 6 o'clock (TimeDial.js:59). At t=0 the dial loses its direction and looks like ⊕. Formula t runs over 0–2 while the clock shows 0–1. The counting and shift slabs are heavy, faint (alpha 0.3) and have no "now" marker, and "+" draws a descending ramp. Fix: one zero at 12, a needle at the leading edge, and labelled formula t. → /impeccable animate
4. [P1] Readouts are cryptic or contradict each other. The key is 10px (CircuitCaptions.js:90) and "\|r\|" is unexplained. Chance bars are linear while Chance2+ bars are sqrt(p/max), so 50% is a half bar in one and a full bar in the other. The phase hand has no 0° reference and hides under label plates. ⊗ means "independent outcomes" but reads as "separable". Assertion labels render at about 6–7px. → /impeccable clarify
5. [P1] Wiring glyphs blur together. X and Y controls differ by 1px marks in a 9px ring; the X control ⊕ is the CNOT target ⊕. The classical wire is one 3px bar across but two lines down. Input A/B links are one anonymous trunk that reads as a control line. A disabled gate is covered by a magenta "Need Input A" box that offers no remedy. → /impeccable polish

## Persona Red Flags
- Alex (power user): no on-screen hint for the Alt/Shift drop modifiers; zoom in fixed 1.25× steps only; at 100% a 6×22 circuit shows 40% of its columns.
- Sam (keyboard / screen reader): the circuit is about the 26th tab stop on desktop, with no skip link; the palette doubles every stop with "Details for…"; the grey cursor ring sits on grey wires; results are canvas-only and missing from the live summary.
- Jordan (first-timer): the empty-state hint is far from the wires; the Examples book has no text; "\|r\| 1.000", "Off/On" and "asser…" are unexplained; the anti-control drops as a tiny hollow ring.

## Minor Observations
- The "off" veil reads as a cursor box, and its tag is 10px.
- The 0 scalar gate is 2.0:1 in dark mode.
- The Rx/Ry/Rz dial sits a column away from its gate, and the hover "change" chip covers the angle.
- Exponents (½, ¼) render at 5–6px at 1×.
- Permutation gates have no caption, and rev2 is a tile while its siblings are drawn as wires.
- Prepare boxes read as holes (1.01:1).
- Post-select tiles have no outline and change shape on hover.
- The Sample caption's bit order is reversed.

## Questions to Consider
- Should wires show state (tinted when superposed, thickened when entangled), so the output column becomes optional?
- Do inputs (\|0⟩) and outputs (Off/On) really want the same tile, or should the bookends say "prepare" and "measure"?
- Is Qiskit's IQP palette worth more than one hue per axis across gates, dials and Bloch?
