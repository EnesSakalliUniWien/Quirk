---
target: Quirk UI compared with Apple HIG and WWDC25 session 208
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/app.jsx"
target_fingerprint: "sha256:47e3219d6b6bf52a2f38a97e1930efe10dba0218025e65accd2284324c63cb6b"
target_path: /Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/app.jsx
timestamp: 2026-10-03T12-43-38Z
slug: src-components-app-jsx
closed: true
---
# Quirk compared with Apple design guidance — 3 October 2026

Target: `src/components/app.jsx` and its circuit-workbench surfaces at commit `8e8ac274`. Mode: Operate. Method: dual-agent (A: `/root/design_review`; B: `/root/implementation_audit`), plus `/root/apple_rules` and parent source/runtime verification. Assessment A finished before detector findings entered synthesis. No application source changed.

## Verdict

The scientific workbench is coherent and product-specific. Preserve the gate vocabulary, canvas, exact state values, contextual mathematics, independent Steps/Time controls, and shared appearance system. The highest-value changes are responsive container behavior and preservation of working state. Adding a glass treatment would not address those problems.

The source-linked catalog is `.impeccable/research/apple-hig-rules-2026-10-03.md`: 33 substantive current HIG articles, one navigation index, and the full actionable guidance from WWDC25 session 208. This is a relevance-based survey across Apple's design site, not every Apple developer document. Native APIs and platform-specific styling are explicitly separated from browser requirements.

## Apple rule-to-implementation comparison

| Rule family | Current Quirk | Assessment |
| --- | --- | --- |
| Adapt to available container space and restore context | Startup-only narrow placement; persistent dock columns squeeze after resizing | F1/F2 fail in reproduced cases |
| Preserve state during environment changes | Circuit and dock survive reload; Undo, playhead, paused t and local drafts do not | F3 fail |
| Prioritize and label commands | Functional toolbar groups, overflow, ARIA names; seven peer inspection/output icons lack visible names | Partial; F4 |
| Use predictable menus | Disabled unavailable toolbar actions; semantic menus and keyboard dismissal | Good foundation; responsive overflow is valid, not a menu-persistence violation |
| Support multiple inputs | Roving toolbar focus, keyboard circuit instructions, native sliders, gate search | Good foundation; touch and cancellation gaps F7/F8 |
| Legible content and meaningful color | Shared DOM/canvas themes; numeric phase and probability, legends and gate symbols | Preserve; contrast and 200% text enlargement not comprehensively measured |
| Purposeful optional motion | Actual reduced-motion clock pause and immediate Bloch transitions with manual controls | Source-confirmed strength, not just CSS suppression |
| Explain scientific graphics | State table, gate matrix/basis explanations, amplitude/Bloch representations | Strong domain specificity; beginner route needs F6 |
| Make temporary surfaces easy to enter/exit | Make gate Cancel restores focus; empty parameter chooser differs from editor | F5 |
| Descriptive document identity | Titles describe wire/operation counts and gate sequence | Partial; user/example titles would be more recognizable, an opportunity not a blocker |

Interpretation: [WWDC session](https://developer.apple.com/videos/play/wwdc2025/208/), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles), [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars), [Charts](https://developer.apple.com/design/human-interface-guidelines/charts).

## Design health

Scores are review judgments, not certification. A's independent desktop score was 26/40; synthesis reduces User Control by one after the confirmed reload/context-loss behavior.

| Heuristic | Score /4 | Evidence |
| --- | ---: | --- |
| System status | 3 | Operation position and separate clocks are visible |
| Match to users' concepts | 3 | Scientific notation fits; some shell terms need interpretation |
| User control and freedom | 2 | Undo and nonmodal panels exist; appearance reload resets session |
| Consistency and standards | 2 | Inspector sizing and exit behavior differ |
| Error prevention | 3 | Disabled commands and parameter checks |
| Recognition over recall | 2 | Named gates; unlabeled inspection icons |
| Flexibility and efficiency | 3 | Keyboard, search, dock and direct manipulation |
| Aesthetic/minimalist design | 2 | Calm work surface, disproportionate chrome and clipped inspectors |
| Error recovery | 2 | Recovery paths exist; empty parameter chooser is a dead end |
| Help and documentation | 3 | Strong local gate explanations; weak first-experiment guidance |
| Total | **25/40** | Significant shell work remains |

## Technical audit

| Dimension | Score /4 | Evidence/limit |
| --- | ---: | --- |
| Accessibility | 3 | Strong semantics and keyboard foundations; no full screen-reader test |
| Performance | 3 | Targeted subscriptions/quantized updates; not profiled |
| Responsive design | 1 | Reproduced cramped persistent columns and clipped Export |
| Theming | 2 | Shared palettes but scheme-change reload disrupts state |
| Implementation integrity | 3 | Coherent system; panel-container sizing drift |
| Total | **12/20** | Acceptable, significant work needed |

Integrity passes as a product-specific architecture with isolated failures; zero mechanical detector findings do not validate layout behavior. Findings: **0 P0, 3 P1, 5 P2, 1 P3** (nine distinct issues). F1–F5 are the priority list; F6–F9 are supplementary.

## Priority findings

### F1 [P1] Existing dock layouts do not adapt to narrow windows

Source: `src/components/dock.jsx:73`, `:129`, `:270`. Narrow placement is only consulted when adding missing permanent panels; restored/live layouts keep columns. Auxiliary inspectors always open to the right without a narrow branch. At an actual 600×800 CSS-pixel viewport, Gates/Circuit/State measured 225/147/228px. At 390×844 they measured 146/100/144px. The empty-state text forms a tall narrow column across the wires, and important results are offscreen.

Impact: ordinary browser resizing leaves the primary circuit task impractical. Recommendation: temporary width-aware collapsed/tabbed presentation, a usable circuit minimum, and restoration of the user's wide layout when space returns. Separate adaptive presentation from the saved user arrangement. Standard: Apple's Layout/Split views and non-destructive adaptation; this is not a demand to redesign a gate palette as navigation. Command: `/impeccable adapt`.

### F2 [P1] Export content uses viewport width inside a dock inspector

Source: `src/styles/panels/shared/sections.css:4`, `src/styles/panels/shared/responsive.css:4`, `src/components/panels/export/export-panel-body.jsx:51`, `src/components/dock.jsx:13`.

`.panel-stack` is `min(780px, calc(100vw - 48px))`, while the default inspector is 32% of the dock bounded at 340–480px. A's 1280px desktop test rendered roughly 780px of Export content in a roughly 410px inspector. The only corrective breakpoint uses window width rather than panel width.

Impact: routine export descriptions/sections are cut off or demand horizontal navigation. Recommendation: container-relative stacks and container breakpoints, preserving intentional horizontal scrolling for wide scientific tables. Command: `/impeccable adapt`.

### F3 [P1] System appearance changes can reset work context

Source: `src/browser/systemColourScheme.js:32`, `src/app/QuirkApp.js:93`, `src/app/session/url.js:142`, `src/components/panels/forge/forge-panel-body.jsx:20`.

Theme changes schedule `window.location.reload()` after an input/drag guard; this guard protects a keystroke, not the complete session. Runtime corroboration used the same reload mechanism, without changing OS settings: Quantum Fourier Transform at operation 19/20, paused t, Undo enabled became operation 20/20, running t, Undo disabled. The circuit and State panel survived. Unfinished forge fields are React-local state and are lost by the same reload path (source-confirmed, not a separately reproduced draft scenario).

Impact: an environmental appearance change can disrupt analysis and discard an unfinished gate draft. Recommendation: update appearance in place; if reload remains necessary, persist and restore full session/drafts. Browser Back history is not the in-app Undo stack. Command: `/impeccable harden`.

### F4 [P2] Inspection commands require memorizing symbols

Source: `src/components/toolbar/app-toolbar.jsx:24`, `:48`, `:323`.

Seven view/output commands are peer icon buttons, with labels only in ARIA/title. They have valid accessible names; the issue is visual discovery and recognition. Recommendation: a stable labeled Views/Inspect command route, meaningful grouping and active/open cues while keeping expert shortcuts. Responsive More is acceptable overflow, not a violation of Apple's static menu rule. Command: `/impeccable clarify`.

### F5 [P2] Parameter chooser has incomplete empty/focus/exit behavior

Source: `src/components/panels/gate-param/gate-param-panel.jsx:26`, `:82`; `src/components/panels/panels.jsx:99`.

With no editable parameter gate, a large floating surface says both choose a gate and no parameter gates. A verified opening from the toolbar retained focus there, and Escape did not dismiss this chooser. The editor branch separately implements focus and Escape; the dock does provide a Close tab control, so this is not a claim that closing is impossible.

Recommendation: coherent empty copy, a direct route to suitable gates, focus on entry, consistent Escape/return behavior, and content-sized empty state. Command: `/impeccable harden`.

## Supplementary findings

- **F6 [P2] First-use examples lack learning structure.** `src/components/toolbar/examples-menu.jsx:35` maps 12 titles directly into a flat menu, beginning with Grover and Shor. Quantum Teleportation opens a large dynamic example with no learning goal. Group a few starter experiments, add brief expected observations and fit the initial view. `/impeccable onboard`.
- **F7 [P2] Touch controls remain dense.** `src/styles/ui/buttons.css:9`, `src/styles/ui/menu.css:29`, `src/styles/shell/toolbar.css:7`. Measured 32×32px toolbar controls, 2px gaps and roughly 31.5px speed rows. Enlarge hit regions for coarse pointers while retaining desktop density. This is a touch-comfort gap, not proof of a WCAG failure or a universal 44px minimum. `/impeccable adapt`.
- **F8 [P2] Time scrubber misses gesture-cancellation recovery.** `src/components/toolbar/time-lane.jsx:149` sets a dragging flag but only pointerup clears it; the readout guard at `:84` then skips updating the thumb. Clear it on pointercancel/lost capture/blur. Source-confirmed path; interrupted touch not reproduced. `/impeccable harden`.
- **F9 [P3] No main workspace landmark.** `src/components/dock.jsx:300` and `src/components/app.jsx:30`. Add a main landmark without changing scoped circuit keyboard semantics. Existing regions/tabs remain useful. `/impeccable harden`.

## Strengths, cognitive load and user journeys

Preserve: named searchable gates with matching circuit symbols; contextual matrices and basis-state explanations; numeric State values alongside graphics; meaningful clock status and reduced-motion behavior; undoable examples; keyboard menu navigation, roving toolbar focus, and Make gate Cancel focus restoration.

Cognitive load is moderate. Seven peer icons and 12 flat examples create avoidable decisions; a dense labeled gate palette is justified by scientific work and should not be condemned just for exceeding four options. Empty-state instructions invite the learner; live examples create interest; unexplained clocks and clipped Export create difficulty at exploration and completion.

First-time learners need a named experiment and visible analysis choices. Experts need accurate data, predictable panel fit and preserved context. Keyboard-dependent users benefit from existing semantics but encounter inconsistent chooser behavior. No general claim of screen-reader inaccessibility is justified by this bounded review.

## Detector and verification limits

`impeccable context` ran once; no PRODUCT.md or DESIGN.md exists. Existing code/assets were the design authority, and this audit did not create or repair product/design briefs.

The detector ran once against `src/components` and returned `[]`: zero findings, no rule names, no false positives. The JSON is saved in `.impeccable/research/impeccable-detector-2026-10-03.json`. Its exit code was not retained because a later wrapper assignment failed. The valid output was not replaced by an unnecessary rerun.

Independent desktop tabs inspected blank circuit, menus, Teleportation, State, parameter chooser, Export, gate details and Make gate. Parent tested actual CSS viewport widths 750, 600 and 390 and restored the override. The decisive panel measurements above were taken after layout settled; early observations immediately after viewport changes were not used as breakpoint evidence. Parent also tested reload consequences.

Browser evaluation is read-only, so live detector injection was unavailable; no overlay was created. No production performance benchmark, full screen-reader session, physical/synthesized touch, 200% text-only test, exhaustive contrast audit, live OS appearance or reduced-motion change was performed. Reduced-motion implementation was verified in source. The separate light/dark tabs were not controlled same-state theme captures. No application tests were rerun because no application code changed; historical passing tests are not claimed as current validation.

## Recommended sequence and decisions

1. `/impeccable adapt`: F1/F2 panel adaptation and container fit; F7 touch targets.
2. `/impeccable harden`: F3 context preservation; F5/F8 focus and gesture recovery; F9 landmark.
3. `/impeccable clarify` then `/impeccable onboard`: F4 discoverability and F6 first experiments.
4. `/impeccable polish`: final bounded visual/interaction pass, followed by an audit of the changed surfaces.

Which scope should come next: the three P1 issues, P1 plus toolbar/chooser usability, or all nine? For navigation, choose a labeled inspection route, compact expert controls, or a switchable combination. These are follow-up design choices, not blockers to this completed review.
