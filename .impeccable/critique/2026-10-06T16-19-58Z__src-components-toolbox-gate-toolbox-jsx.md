---
target: Gates sidebar
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/toolbox/gate-toolbox.jsx"
target_fingerprint: "sha256:902a7a841daeef6fbcafe52f97542ed4094ddc99b98247b8bb982fa18a338c0b"
target_path: /Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/toolbox/gate-toolbox.jsx
timestamp: 2026-10-06T16-19-58Z
slug: src-components-toolbox-gate-toolbox-jsx
closed: true
---
Method: dual-agent (A: /root/sidebar_design · B: /root/sidebar_evidence)

# Gates sidebar review

**27/40 — Acceptable.** The visual structure fits Quirk; interaction intent is the main weakness. Current unstaged target: src/components/toolbox/gate-toolbox.jsx. No source changes made.

## Design specificity and strengths
Authored for Quirk: recognizable circuit symbols and colors, scientific categories, named rows, and exact matrices/rotation diagrams make the palette useful to circuit-literate users. Preserve this structure.
- Symbol plus name connects the palette to the canvas.
- Search and roving keyboard navigation make a long catalog manageable.
- Persistent details fit the inspected narrow viewport; Escape returns focus correctly.

## Priority issues
1. **[P1] Narrow-screen gate selection can place a gate before the user chooses a destination.** At 390×844, an ordinary pointer click on Hadamard switched from Gates to Circuit and inserted H in column 0 (5 to 6 operations). Pointerdown starts a grab immediately, activates Circuit, then pointer release commits against the newly visible canvas. The same broad row surface uses touch-action:none, so vertical touch scrolling cannot begin there; source comments direct scrolling to gaps/headings, with 2px row gaps. The click was reproduced; touch scrolling is source-confirmed, not physically tested. Fix: distinguish deliberate dragging from stationary activation, avoid committing a stationary grab after the tab switch, and allow vertical panning over row content. Reuse the existing placement pipeline. Suggested command: /impeccable harden, with /impeccable adapt for touch arbitration. Sources: gate-toolbox.jsx:102, gates-panel.jsx:21, toolboxDrag.js:76, tiles.css:41.
2. **[P2] Keyboard placement has an implicit destination.** Return places into the remembered circuit cursor cell, otherwise the end of the top wire; the palette does not explain that rule or its arrow-key navigation. A successful shortcut can therefore edit somewhere the user was not expecting. Add one concise instruction associated with the list and state the current destination/fallback. Suggested command: /impeccable clarify. Sources: gate-toolbox.jsx:211, toolboxDrag.js:109.

## Design health
| Heuristic | Score | Key issue |
|---|---:|---|
| System status | 3 | Search updates have no live result status |
| Real-world match | 3 | Scientific symbols and names align |
| Control and freedom | 2 | Narrow activation can choose an unintended destination |
| Consistency | 2 | Row activation changes meaning with layout/input |
| Error prevention | 2 | Stationary pointer activation can commit |
| Recognition | 3 | Placement rules remain implicit |
| Efficiency | 3 | Search and roving navigation work |
| Minimalist design | 3 | Clear groups and compact rows |
| Recovery | 3 | Undo and detail dismissal work |
| Help | 3 | Rich scientific details; manipulation guidance missing |
| **Total** | **27/40** | **Acceptable** |

## Cognitive load and emotional journey
More than four choices are visible, but coherent scientific categories and search justify the catalog density for this audience. The unnecessary memory burden comes from different pointer/keyboard/narrow-layout placement rules. Desktop browsing feels precise; the abrupt narrow transition into a modified circuit undermines that confidence.

## Persona flags
- Power user: efficient search/Return, but insertion depends on remembered cursor state.
- Keyboard-dependent researcher: named controls and arrow navigation work; placement rules are not explained in the palette.
- Mobile user: the broad row surface grabs instead of allowing normal panning; narrow stationary activation can edit the circuit.

## Minor observations
The empty search message is ordinary text with no live region or explicit recovery hint. Some chip text ellipsizes, but complete adjacent names retain meaning. No evidence warrants new categories, favorites, or a redesign.

## Evidence and limits
- 7/7 existing toolbox production E2E tests passed.
- Native browser inspection: 1280×720 and 390×844; desktop search, empty state, details, focus return, arrow navigation; narrow details and pointer insertion.
- Deterministic scan of gate-toolbox.jsx: exit 0, JSON [], zero findings. It does not detect these behavioral issues.
- No injected overlay: native evaluation is read-only.
- Physical touch and VoiceOver were not tested.

Questions skipped: 2 Priority Issues; recommended order is placement/scrolling, then keyboard guidance, followed by polish.
