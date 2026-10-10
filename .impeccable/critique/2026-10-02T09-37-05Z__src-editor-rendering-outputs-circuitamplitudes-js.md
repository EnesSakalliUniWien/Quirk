---
target: the state-vector grid
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/editor/rendering/outputs/CircuitAmplitudes.js"
target_fingerprint: "sha256:bd88ee3c13740b592d863f110ab5403f0fc4b09f821167d2a451564750663012"
target_path: /Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/editor/rendering/outputs/CircuitAmplitudes.js
timestamp: 2026-10-02T09-37-05Z
slug: src-editor-rendering-outputs-circuitamplitudes-js
---
Method: dual-agent (A: two Sonnet design reviewers - reading the grid, its encodings · B: one Sonnet detector and in-app-browser agent)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "· after operation n" at 9.65px; measurement caveat ignores the playhead; phase reference unstated |
| 2 | Match System / Real World | 2 | "log chance", tooltip "mag²", ket reads bottom wire first unexplained |
| 3 | User Control and Freedom | 2 | Hover-only drill-down; no pin, no phase reference, nothing on touch |
| 4 | Consistency and Standards | 3 | One wheel and painter with the Amps gate; chance named "mag²"; "kept" in error magenta |
| 5 | Error Prevention | 2 | Chance gauge silently vanishes; measured circuit shows a full superposition |
| 6 | Recognition Rather Than Recall | 2 | Bit order unstated, "⋯" unexplained, key without sample marks |
| 7 | Flexibility and Efficiency | 2 | No label crosshair, no link to the State panel, no scale choice |
| 8 | Aesthetic and Minimalist Design | 2 | Five marks on five scales; 28/32 cells empty in the user's case |
| 9 | Error Recovery | 2 | NaN as one word; "kept: 0%" unexplained |
| 10 | Help and Documentation | 2 | Accurate key, but run-on and silent on log scale, hand length, global phase |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict
- LLM: authored core (hand + zero tick + log ring floored near 3e-7, row+column bits with ⋯, one painter shared with the Amps gate); generic reading chrome (prose key, gate-coloured label plates, five marks on five unreconciled scales).
- Deterministic: CLI 0 findings in src/editor/rendering/outputs and src/draw/displays/complex (also --no-config); overlay 1 finding (layout-transition on body) - a dockview false positive. The detector cannot see canvas content; measured: labels 12px 11.2:1, title 9.65px, key 10-12px, log ring 2.3:1 dark / 1.9:1 light, no text alternative for the grid.

## Priority Issues
1. [P1] Chance unreadable: gauge drawn before the grid halo (MatrixView.js:154 vs :169) loses its bottom 1.5 units - 1/32 shows ~0.4px; nothing below ~4% at 5 qubits; disc is √chance; tooltip leads "val:", "mag²". Fix: gauge after the halo, 2px minimum, 100% rail; "21.3% chance" in the tooltip; percentages in big sparse cells. → /impeccable harden
2. [P1] Bit order and ket assembly unstated (rows high bits, columns low bits; |10000⟩ = q4 = bottom wire). Fix: wire names over the label strips; "ket = row bits, then column bits" in the key. → /impeccable clarify
3. [P1] Global phase neither chosen nor labelled (CircuitAmplitudes.js:39, CircuitOutputState.js:20): Y·Y 180° vs X·X 0°; Amps1 gates lock while the grid does not. Fix: lock to the largest amplitude by default, caption "phase relative to |11⟩", absolute as a switch. → /impeccable clarify
4. [P2] Hand length pinned to the log ring (ComplexCellGeometry.js:78) - an undeclared chance scale; hand hue lost on the cyan disc from -150° to 180° (ΔE 6-11, 1.2:1). Fix: hand = amplitude, ring alone carries log with key ticks; disc out of the wheel's family or a light hand casing. → /impeccable distill, /impeccable colorize
5. [P2] Key and caveats: title 9.65px (fitText height 16, CircuitCaptions.js:85); key wraps mid-phrase; strip labelled only at its same-coloured ends; deferred caveat global (CircuitCaptions.js:109); "kept" in error magenta without a noun; pixel mode from 13 qubits (no wireCount) vs docs' "past five". Fix: 12px+ semibold title, 2×2 legend, −90/0/90 ticks, grouped plain-sentence caveats that follow the playhead, pass wireCount or fix docs. → /impeccable typeset

## Persona Red Flags
- Jordan: ⋯ labels meaningless; "bar" read as the bar in |amplitude|; hover undiscovered; hand length taken for amplitude; H-wall shows no bars; Y·Y 180° hands; magenta "kept" reads as an error.
- Alex: exact chances without hover, bit order, phase-reference choice, dB ring scale, pinnable cells, State-panel link, copyable values.
- Sam: no text alternative; deutan collapses hues 45° apart to ΔE 1.2 (pixel mode has only hue); ring 1.9:1 light; gauge 1px at 1x; gauge vs disc nearly hue-only.

## Minor Observations
- Tooltip covers neighbours; label plates read as gates; zero tick collides with the grid line; strip has no exact-0° swatch; light wheel olive-brown at 60-110°.
- Density disc is chance green; Bloch vector green; wheel 5° ≈ Bloch y pink (ΔE 5.8).
- Grid starts past the 784px canvas on load; column labels 480px below the top row at 5 qubits.
- Pixel opacity's 30% floor flattens 1-30% amplitudes.

## Questions to Consider
- Hover-link cells and the State panel's rows?
- A sorted list for sparse states instead of an 88%-empty grid?
- Hand length = amplitude, ring as the 100% reference?
