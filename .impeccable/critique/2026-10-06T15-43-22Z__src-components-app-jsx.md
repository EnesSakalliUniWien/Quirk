---
target: Unstaged UI changes in Quirk
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/app.jsx"
target_fingerprint: "sha256:b505cf529bfc7facc983ade64f074de3df5f30934275d54f49d0b55c7d799ed1"
target_path: /Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/app.jsx
timestamp: 2026-10-06T15-43-22Z
slug: src-components-app-jsx
closed: true
---
Method: dual-agent (A: /root/design_review · B: /root/browser_evidence)

Target: src/components/app.jsx and its unstaged UI changes, compared with the Git index. Mode: Operate. Assessment A finished before Assessment B findings entered synthesis. No application source edits.

**Verdict: 29/40 — Good. Fix narrow Bloch control placement first.** This is a heuristic score of the inspected current experience, not a score for every changed file or a release certification.

**Design specificity and overall impression**

Quirk feels authored for a quantum workbench. The circuit, mathematical gate construction, independent Steps/Time controls, and scientific readouts give it a coherent identity. The changes improve discoverability and recovery. The largest remaining problem is spatial: the new Bloch layout separates controls from the figure they change.

**Design health**

| Heuristic | Score | Evidence or limitation |
|---|---:|---|
| System status | 3/4 | Operation counters, active tabs and scientific source labels communicate state. |
| Match with users' world | 4/4 | Circuit, amplitude, probability and snapshot language fits the intended audience. |
| User control | 3/4 | Undo, Cancel, closable inspectors and restored desktop docking; not every recovery path tested. |
| Consistency | 3/4 | Shared visual language; Inspect and More duplicate navigation. |
| Error prevention | 3/4 | Disabled unavailable actions and explicit matrix correction; failure edges untested. |
| Recognition over recall | 3/4 | Named Inspect and actionable parameter empty state; several icon-only routes remain. |
| Efficiency | 3/4 | Search and dock flexibility work; narrow Bloch requires excessive scrolling. |
| Minimalist design | 2/4 | Supporting Bloch figures displace controls; duplicate menu choices add noise. |
| Error recovery | 3/4 | Deletion recovery and copy fallback present in source, not failure-tested live. |
| Help | 2/4 | Useful contextual explanations; overall interaction-help discovery remains a baseline weakness. |
| **Total** | **29/40** | **Good; all ten heuristics apply.** |

**What works**

1. Scientific distinctions remain visible: amplitude, probability and phase have separate explanations; mixed qubits do not receive invented Bloch angles.
2. Gate parameter recovery is actionable. Live checks confirmed that the empty chooser focuses Find a rotation gate, Escape returns focus, and the find action focuses gate search.
3. Responsive docking preserves orientation: inspected panels become tabs at 390px and return to separate desktop columns. Examples now distinguish starter circuits from advanced examples.

**Priority issues**

1. **[P1] Narrow Bloch puts exploration controls after three figures.** At 390×844, the first view shows the sphere and the Meridian heading. The State source heading measured y=1614px, while the floating panel's visible bottom was about y=756px. Users scroll past all figures to change the state, losing sight of the result. This is attributable to the changed Figures → State source → Readout order and stacked projections. Fix: put compact state controls directly after the sphere on narrow panels, followed by Meridian/Equator and advanced layers. Preserve all scientific content. Suggested command: `/impeccable adapt`.

   Sources: [Bloch component](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/bloch/bloch-panel.jsx:155), [responsive layout](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/styles/panels/bloch.css:50).

2. **[P2] Inspect and More repeat the same six readouts at phone width.** At 390px, More contains eight entries, including all six readouts already under Inspect. Two nearby menus appear to describe different categories but lead to the same panels. This was introduced by adding Inspect while retaining those destinations in overflow. Fix: retain the named Inspect menu and useful desktop shortcuts; limit narrow More to creation, parameter and export utilities. Suggested command: `/impeccable distill`.

   Source: [toolbar menu construction](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/toolbar/app-toolbar.jsx:218), [overflow rendering](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/toolbar/app-toolbar.jsx:529).

**Cognitive load and emotional journey**

Moderate load: three checklist failures—chunking, minimal choices, and working-memory demand. Single focus, grouping, overall hierarchy, one decision at a time, and progressive disclosure largely pass, with the Bloch exception above. Eight choices in More and duplicated destinations add avoidable decisions; scientific presets are not inherently wrong merely because they exceed four choices. Bloch forces users to remember the figure while reaching its controls.

The empty circuit and starter examples make entry reassuring. Circuit and readout agreement creates a useful explanatory moment. Narrow Bloch then interrupts exploration by burying the controls. Recording labels and recovery affordances support confidence, although persistence failure paths were not exercised.

**Persona red flags**

- Circuit-literate newcomers must infer why Inspect and More contain the same tools.
- Researchers exploring a qubit must scroll between the state controls, sphere and numerical readout.
- Power users retain desktop shortcuts and docking flexibility, but narrow overflow adds unnecessary navigation choices.

**Minor observations and evidence boundaries**

State-table phase-header clipping in a roughly 410px side pane and dense horizontal recording cards were observed but are preexisting; they are not counted as regressions. Most forge/math changes are formatting-only.

The bundled detector scanned 70 changed JSX/HTML targets and returned zero findings, zero advisories and no false positives. It did not detect either contextual UX issue. Native browser evaluation was read-only, so no injected overlay exists. Browser console query returned no warnings/errors in B's sampled flows.

Live review covered light theme at 1280×720 and 390×844, using a fine pointer. Physical touch, dark theme, screen-reader operation, Safari, 200% zoom, and full failure/recovery behavior are unverified. No full test suite was run. The temporary Vite server was stopped and browser viewport overrides reset.

Scope analysis normalized the 153 changed JS/JSX/CSS files in components/styles/appearance in temporary files: 89 were formatting-only; 64 retained non-format changes. This narrowed review effort; it is not a claim that all 64 change behavior or that every unstaged file was fully audited.

Evidence: [narrow Bloch screenshot](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/.impeccable/critique/evidence/2026-10-06-unstaged/bloch-390.jpg), detector.json and detector-targets.json in the same evidence directory.

Questions skipped: this critique identified two priority issues.
