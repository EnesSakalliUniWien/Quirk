# Quirk Impeccable refinement brief and agent plan

Status: implemented and verified on 5 October 2026, following the user’s approval (“Apply the changes” and “Using sol agents with ponytail”). See the [implementation report and isolated patch](../reviews/2026-10-05-impeccable-implementation/README.md).

## Confirmed brief

**Audience:** circuit-literate learners and researchers exploring or debugging small quantum circuits. **Outcome:** reliable editing, truthful accessible controls, recoverable results, and readable inspection workflows. The user confirmed **verified fixes first, then targeted polish** on 5 October 2026.

**Surface:** the existing browser workbench in `src/components/app.jsx`, with targeted work in Tape, Export, circuit/register controls, Forge text, and Algebra descriptions. **Visitor mode: Operate.** Task clarity, precision, continuity, and consistency take priority over visual novelty.

**Authority:** the current implementation, shared appearance data, and captured production screenshots define the incumbent interface. Preserve its Geist/monospace roles, component vocabulary, dock structure, and scientific displays. Missing `DESIGN.md` does not justify redesign. [PRODUCT.md](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/PRODUCT.md) records confirmed product context; this brief carries the surface strategy.

**Evidence:** use the completed [HIG review](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/README.md). Its 172-page matrix establishes review coverage; its build and 116/116 E2E results are the pre-implementation baseline. Do not repeat the whole audit or present those results as proof of later edits.

## Impeccable workflow

| Stage | Command/playbook | Deliverable and boundary |
|---|---|---|
| 1. Establish context | `init` → `shape` | PRODUCT.md is written from the user's confirmed audience/scope. This brief is the reviewable Shape result. Existing visual authority is preserved. |
| 2. Correct verified failures | Scoped `harden` + `clarify` | Tape recovery, clipboard feedback, numeric dial semantics, text composition, and Apple Control-click work correctly. |
| 3. Refine affected surfaces | Scoped `typeset` + `adapt` + `clarify` | Browser font preference is respected, Forge prose stays usable, Evolution's description is truthful, and Circuit link wording describes the user's task. |
| 4. Verify and finish | Targeted `audit` checks → `polish` | One integrated browser/visual pass, one correction batch, at most one confirmation pass, one detector invocation, and an independent diff review. |

Read Impeccable's `craft-floor.md` immediately before the first UI edit. It was deliberately not applied as an editing pass during planning. Use Operate guidance where generic examples conflict: stable role-based typography rather than fluid marketing headings, meaningful scientific color rather than decorative accents, and contextual information rather than compulsory onboarding.

There is no new surface, replacement visual world, image-comp workflow, dependency installation, or global token migration in this plan. A separate `document` pass can capture the incumbent design system later if useful; it is not a prerequisite for these narrow refinements. No persistent image-generation workflow default is selected by this plan.

## Agent assignments and execution order

Use **GPT-6.1-Sol** for the three domain agents, matching the user's requested Sol team. Keep the lead as integrator and sole shared-browser owner. Fresh implementation agents execute the approved, source-grounded planning with nonoverlapping ownership.

| Owner | Responsibility | File boundary |
|---|---|---|
| A — Recovery and feedback | Tape Undo; truthful clipboard outcomes; Circuit link wording | `src/results/tapeStore.js`; `src/components/panels/tape/{tape-body,take-card}.jsx`; `src/components/panels/export/{copy-button,export-panel-body}.jsx`; `test/results/tapeStore.test.js`; `test_e2e/tape.test.js` |
| B — Accessible interaction | Dial semantics/formula state; composition-safe existing inputs; Control-click routing | `src/components/panels/circuit/{wire-dial,rename-box}.jsx`; `src/components/panels/registers/register-row.jsx`; `src/app/canvas/canvasPointer.js`; narrowly required `src/editor/interaction/PixiPointerGestures.js`; relevant register/circuit/gate-menu tests |
| C — Presentation and accessibility verification | Font scaling; chart overview; measure-first State/contrast concerns; polish proposals | `src/styles/foundation/document.css`; necessary `src/browser/theme/dom.js`; `src/styles/panels/forge/construction.css`; `src/components/panels/algebra/evolution-chart.jsx`; optional description prop in `src/components/math/data-view.jsx`; `test_e2e/debugPanels.test.js` and applicable layout tests |
| Lead / final reviewer | Integration, shared tests, browser evidence, detector, independent final review | Lead owns `test_e2e/overlays.test.js`, `test_e2e/accessibility.test.js`, runner registration, and shared verification. After worker slots free, a fresh Sol reviewer assesses the integrated diff without editing it. |

**Scheduling:** A and B implement in parallel after approval. C prepares the existing type/description contract and measurements without editing shared surfaces during that wave, then implements the bounded presentation changes after the functional work lands. C owns the chart description; B must not also edit it. A owns all Tape changes, so recovery and copy feedback cannot race within TakeCard.

Workers propose additions to shared test files; the lead applies them serially. If B confirms the same composition bug in existing Bloch or gate-search text handlers, the lead assigns those exact files to B before editing. No broad speculative keyboard refactor. Only the lead starts shared Vite/build/browser processes. No new user-owned chats are required.

Preserve the dirty checkout. Capture current file hashes/diff at execution start, assign nonoverlapping writes, and review only task changes against that snapshot. If isolation is needed, preserve the dirty implementation in the isolated starting state; a clean HEAD worktree would omit the UI under review. Do not reset, stage, commit, or clean up unrelated work as part of this plan.

## Work package A — recovery and feedback

### Tape deletion

**Proposed contract:** an explicit Tape Undo restores the most recent successful deletion during the current app session. It survives closing/reopening the Tape panel, remains until the next successful deletion or dismissal, and is not persisted across reload. A restoration that has already succeeded is durable and survives reload. Global Command-Z keeps its circuit-editing meaning.

Capture the authoritative record inside the existing queued store transaction, after earlier metadata writes and stale-index refresh. Clicking Delete can first blur and save a name/notes field; a snapshot taken from rendered props can therefore be stale. Return a recovery record only after deletion commits. Reuse the current transaction queue, admission rules, value stores, and existing export helpers.

Saved takes regain their exact ID, contents, notes, saved status, and ordering. A manually deleted ghost regains its ghost status as the newest ghost under the existing eight-ghost/storage cap; it must not silently become a saved take. The UI must not report recovery unless the restored item survives admission. Keep one recovery slot with the session-lived Tape store/recorder, not component-local state that disappears on panel closure. This is a bounded Undo feature, not a general history or Trash subsystem.

For failed delete, preserve the previous recovery slot and existing record. For failed restore or a newer same-ID record, retain the recoverable snapshot, explain the problem, and offer retry or an existing JSON download route; never overwrite newer data silently. Serialize rapid destructive requests, prevent duplicate Undo, remove stale comparison selection, and put keyboard focus on a useful surviving control.

Acceptance evidence: edit notes/name → Delete → Undo → reload restores exact saved data; two deletes restore only the latest; failed second delete retains the first recovery; panel closure does not discard Undo; ghost/cap/conflict cases report truthful outcomes. Extend the existing TapeStore and Tape E2E suites.

### Clipboard and wording

Replace Export's independent one-second result timer with existing `notify(title, description)`. Keep the copy button pending only while its operation is pending. Give operation-specific success feedback and useful failure text. Do not call every exception a permission denial: generation failures, unavailable Clipboard API, and rejected writes need truthful messages.

Export can point to selectable output; Tape JSON/CSV can point to its existing downloads. Do not offer a nonexistent selectable Tape link. Preserve the click's intended data while awaiting the clipboard. Completion after panel closure can still announce through the global notification surface; avoid updating an unmounted component.

Rename **Escaped link** to **Circuit link** while preserving its output and accurate compatibility explanation. Do not rename scientific terms or add a glossary project.

Acceptance evidence: success/denial/unavailable clipboard produces perceivable feedback; errors persist beyond 1.2 seconds; retry is available after completion; rapid activation and panel closure do not alter circuit/Tape data. Verify the actual notification live-region behavior in-browser; speech remains a separate VoiceOver check.

## Work package B — accessible interaction

### Numeric and formula dials

For finite constant angles, use semantics suited to an unbounded numeric adjustment, preferably `spinbutton`, with the actual signed degree value and existing readable degree text. Preserve fractional values, negative values, full turns, exact expressions until edited, and the current preview/one-commit behavior. Do not invent 0–100 or 0–360 scientific bounds.

Treat formula/non-finite states honestly: no stale numeric accessibility value and no accidental conversion of a formula through numeric wheel/arrow input. Reuse the existing parameter editor as the formula state's activation route. Preserve the visual dial and ordinary finite-angle pointer interaction. Do not represent Home/End as finite domain bounds; the proposed unbounded control leaves those keys unhandled instead of inventing new reset controls.

Acceptance evidence: accessibility tree exposes −90°, 180°, 720°, and a fractional angle accurately; focus does not rewrite expressions; a settled adjustment is one undoable edit; numeric-to-formula transition does not expose the previous numeric value; formula activation reaches the exact editor. Test through the existing parser and gate actions, not a new math implementation.

### Composition and Control-click

Reuse existing `nativeEvent.isComposing` guards before consuming text-entry Enter/Escape. Cover both canvas rename and Registers fields; trace sibling handlers and fix only those with the same confirmed boundary error. Keep composition keys out of circuit/global handlers and preserve ordinary Enter/Escape/blur behavior and current identifier validation. Synthetic events establish branch behavior, not every real IME's behavior.

Route Apple Control-primary-click through existing `openMenuAt` before starting a drag or preview. The pointer watcher currently becomes active before invoking `onGrab`; an early return alone can leave a live gesture. If needed, add one explicit optional grab veto to that existing watcher and test its callers. Suppress the browser menu only for a handled application target. Empty-canvas Control-click retains the browser menu; ordinary right-click, touch hold, Option-copy, Apple Command-drag, and non-Apple Ctrl-drag retain their behavior.

Acceptance evidence: composing keys preserve the text/editor/model, ordinary keys still work; Control-click and right-click expose equivalent relevant menus without circuit/history mutation; cancel/blur/outside release leaves the next ordinary drag usable; numeric dials retain one-commit semantics. Add tests to existing gesture/register/circuit suites and give shared overlay/accessibility additions to the lead.

## Work package C — targeted presentation

Honor the browser's preferred root font, then replace only affected fixed-size Forge explanatory/error text with existing role tokens. Preserve the current numeric renderer sizes and the design-unit denominator used to produce rem values. Start with the smallest root/style patch; remove obsolete token output only after checking consumers.

Root font changes also scale rem-based spacing and radii. Verify dock minimums, toolbar wrapping, MathLive forms, Base UI popup placement, and the mix of DOM text with pixel-based circuit geometry before adding local reflow fixes. Do not enlarge every scientific numeric label or change circuit zoom to compensate.

Give Evolution a concise accessible overview: columns represent successive circuit steps, rows represent basis states, and the rendering encodes magnitude and phase. Read both detailed-mark and dense-pixel rendering paths before writing copy; explain aggregation where it occurs. Associate the description with the existing canvas and identify the existing State/step exact-value route. Do not invent a trend summary or thousands of hidden data marks.

**Conditional work:** State virtualization and contrast require evidence first. A 256-entry table exposing 24 mounted rows is not alone proof of unusable VoiceOver navigation. Test first/middle/last-row inspection with real assistive technology when available. If it fails, add the smallest explicit paging or basis-row route using existing virtualization. If unavailable, record the remaining check instead of fabricating a pass/failure. Measure actual neutral text/control/focus contrast under light/dark and reported contrast preferences before altering tokens; retain scientific phase color and numeric alternatives.

Acceptance evidence: enlarged interface text leaves core tasks reachable and numerical outputs unchanged; canvas hit targets/cursor/minimap stay aligned; chart descriptions are truthful in small and dense modes. Cosmetic adjustments stay within the affected workflows and existing visual identity.

## Verification and completion

1. **Behavior tests:** workers add meaningful regressions to the existing suites. The lead runs current unit/E2E checks after integration, plus lint and diff checks appropriate to the changed files. Preserve and report pre-existing diagnostics rather than attributing them to this work. Run performance checks only if a rendering/virtualization change or measured regression warrants them.
2. **Batched browser round:** desktop, intermediate, 320–430px narrow, and a short landscape layout; pair light/dark, preferred font 32px, reduced motion, and coarse-pointer tests without testing every permutation. Configure touch before measuring. Check full-page 200% zoom where browser tooling can genuinely control it; a reduced viewport or CSS zoom is not equivalent evidence. Include error, pending, empty, long-name, saved/ghost, and small/dense scientific states.
3. **One correction batch:** fix demonstrated failures and apply any evidence-supported State/contrast changes. One confirmation round checks failed cases plus a desktop/narrow smoke pair. Do not launch an open-ended polish loop.
4. **One detector pass:** after UI changes, the lead runs Impeccable `detect --json` on touched UI targets and inspects every finding. Scientific exceptions require narrow reasons. A clean detector is not accessibility or visual-quality certification. The independent reviewer checks the complete diff, acceptance evidence, scientific invariants, and accidental churn.
5. **Delivery:** report actual current tests, before/after evidence, changed files, and remaining native checks. Keep Safari/VoiceOver, physical touch, native CJK composition, and OS contrast propagation distinct from Chromium/emulated evidence. Do not mark an unverified device workflow as passed.

Before/after comparison uses the current working tree, not the older closed Impeccable critique. The audit's Chrome 154 executable is a known available fallback if Puppeteer's expected version is absent; verify it at execution time instead of installing packages automatically. Shared build output and test registrations remain lead-owned.

## Decision for this brief

The recommended sequence is **A+B in parallel → C → integrated verification → fresh review**. The proposed bounded behavior choices are session-lived single-delete Tape Undo, recent-ghost restoration under the existing cap, truthful unbounded dial semantics with a formula-editor route, and measurement before conditional State/contrast changes.

The user approved this brief. The execution baseline preserves 826 current-tree files in `/tmp/quirk-impeccable-implementation-20261005/before`; A and B implement with the ownership above while C prepares the presentation changes read-only.
