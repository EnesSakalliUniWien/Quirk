# Apple HIG review of Quirk — 5 October 2026

**Start with Tape deletion recovery and the rotation dial's accessibility semantics.** The current interface already supports responsive layouts, keyboard circuit editing, independent Steps/Time transport, live appearance changes, and reduced motion. The strongest remaining problems are specific failures in recovery, feedback, and custom input handling. They can be corrected with existing store APIs, controls, and accessibility patterns.

Three GPT-6.1-Sol agents reviewed the six HIG categories in parallel and follow-up assignments, using Ponytail at full intensity. The primary agent reconciled findings, checked the current source, built the application, ran its existing end-to-end suite, and performed targeted browser experiments. **This was a review; application and test files were not edited.**

## Scope and coverage

The [current Apple HIG](https://developer.apple.com/design/human-interface-guidelines) was retrieved on 5 October 2026 through Apple's public DocC JSON, because the HTML endpoint returns a JavaScript shell. The inventory follows every `topicSections` child from the six top-level categories. It contains **172 pages: 6 category pages, 8 Components group pages, and 158 leaf pages**, with no missing child-topic fetches. Platform guidance and inline subsections were considered. This is taxonomy and source-review coverage, not a claim that all platform behavior has been tested.

| Category | Pages including category/group pages | Review |
|---|---:|---|
| Getting started | 10 | [Platform and design-principle review](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/getting-started-report.md) |
| Foundations | 19 | [Foundations review](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/foundations-report.md) |
| Patterns | 26 | [Patterns review](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/patterns-report.md) |
| Components | 73 | [Components and Inputs review](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/components-inputs-report.md) |
| Inputs | 14 | [Components and Inputs review](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/components-inputs-report.md) |
| Technologies | 30 | [Technologies review](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/technologies-report.md) |

The [complete page-by-page matrix](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/coverage.md) records applicability, evidence, and linked findings. [Machine-readable coverage](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/coverage.json) also retains each page's section headings. [Source provenance](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/source-manifest.json) retains source URLs, retrieval time, and content hashes. VoiceOver appears once under Technologies in the merged inventory; the Foundations specialist also reviewed it.

Current guidance includes the September 9, 2026 updates to [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) and [Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo), plus June 2026 guidance on design principles, menus, search, and visionOS interactions. Older platform-specific statements were not treated as universal browser requirements. Browser resizing does not establish folded-device behavior.

**Interpretation:** apply HIG principles to a browser-based scientific editor. Apple APIs, native window chrome, SF Symbols, Liquid Glass, commerce, health services, TV/Watch interfaces, and spatial input are not mandatory features for Quirk. Scientific phase colors, exact angle expressions, negative/multiple rotations, and separate Steps/Time meanings must survive any fix.

## Five priority fixes reproduced in Chromium

All five are P2: concrete problems worth fixing in a focused follow-up. No P0/P1 issue was established by this audit. Reproductions ran against the fresh production build in an isolated browser context with disposable test data.

### 1. PAT-01 — Saved Tape results have no deletion recovery

One saved result became zero after Delete, remained zero after Command-Z, and remained zero after reload. No confirmation dialog appeared. The source removes the record and its notes from IndexedDB; circuit Undo operates on a different history. A separately exported copy is currently the recovery route.

Evidence: [Delete action](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/tape/take-card.jsx:35), [persistent deletion](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/results/tapeStore.js:164), [browser measurements](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/browser-evidence.json). HIG: [Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo), [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback).

**Ponytail fix:** retain the last deleted record in Tape and offer an explicit Undo using existing `store.write`. No general history framework or Trash subsystem is needed. Routine circuit deletion is already undoable; do not add blanket confirmation dialogs there.

Acceptance check: delete a saved take with notes, choose Undo, reload, and verify the exact take and notes return.

### 2. CI-02 — Rotation dials expose incorrect accessible numeric values

The custom dial declares `role="slider"` without bounds. In the Chromium accessibility tree, 180° and 720° both became value 100, while −90° became 0, with an implicit 0–100 range. The scientific model and DOM attributes still retained the true angles. This is an accessibility representation defect, not a simulation error.

Evidence: [dial semantics](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/circuit/wire-dial.jsx:157), [accessibility-tree measurements](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/input-evidence.json). HIG: [Sliders](https://developer.apple.com/design/human-interface-guidelines/sliders), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). Web implementation boundary: [WAI-ARIA slider defaults](https://www.w3.org/TR/wai-aria-1.2/#slider).

**Ponytail fix:** use semantics appropriate to an unbounded numeric adjustment, such as a spinbutton with compatible keyboard behavior, while retaining the existing degree text and exact parameter editor. Do not clamp angles to 0–360 or invent artificial scientific limits to accommodate a slider role.

Acceptance check: negative, 180°, 720°, and formula states report truthful values; native VoiceOver adjustment is then checked separately.

### 3. CI-03 — Rename consumes Enter during text composition

A synthetic browser key event with `isComposing=true` and Enter was prevented and closed the register rename editor. Its handler treats composition confirmation as an application commit. The Registers panel has the same missing guard. A real CJK input-method session was not exercised, so the reproduced result is the event-handling failure rather than a claim about every IME.

Evidence: [canvas rename handler](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/circuit/rename-box.jsx:55), [Registers field handler](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/registers/register-row.jsx:85), [composition experiment](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/input-evidence.json). HIG: [Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields), [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards).

**Ponytail fix:** reuse the composition guard already present in the formula/Forge editors before consuming Enter/Escape. Preserve the current register-name validation rules.

Acceptance check: composing Enter/Escape does not apply or discard a rename; ordinary Enter/Escape retains its current behavior.

### 4. CI-05 — macOS Control-click misses the gate context menu

On the same gate, right-click opened the application menu and Control-primary-click did not. The latter emitted a native `contextmenu` event between pointerdown and pointerup, but Quirk opens its menu from Pixi's `rightclick` path. The tested circuit hash stayed unchanged; no data-loss claim is made.

Evidence: [primary grab path](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/app/canvas/canvasPointer.js:257), [menu event path](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/app/canvas/canvasPointer.js:429), [event-order experiment](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/input-evidence.json). HIG: [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus), [Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices).

**Ponytail fix:** route macOS Control-click through the existing menu-opening helper and avoid starting a primary drag for that gesture. Reuse platform detection and preserve other platforms' modifier behavior.

Acceptance check: Control-click and right-click expose the same relevant menu without changing the circuit or beginning an edit.

### 5. PAT-02 / CI-01 — Clipboard failure feedback disappears and is not announced

Forced clipboard denial displayed “It didn’t work…” in a plain span. The result had no status role, live region, or relationship to the focused button, and was blank after 1.2 seconds. Tape copy success also has no explicit feedback in its source path. Actual VoiceOver speech was not tested.

Evidence: [shared CopyButton](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/export/copy-button.jsx:14), [Tape action wrapper](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/tape/tape-body.jsx:17), [denial measurements](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/browser-evidence.json). HIG: [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Labels](https://developer.apple.com/design/human-interface-guidelines/labels).

**Ponytail fix:** reuse existing persistent, dismissible [notify](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/ui/toasts.jsx:18). Report success; on failure, explain that the browser did not allow copying and point to the displayed text or an available download. Keep the button disabled only while copying is pending.

Acceptance check: successful and denied copy both produce accessible feedback; failure information remains until dismissed or replaced.

## Additional findings and unresolved checks

| ID / priority | Evidence and practical limit | Smallest appropriate response |
|---|---|---|
| FND-02 / P3 | Browser font preference changed to 32px; the app root remained 16px and Forge description 12px. [Source](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/styles/foundation/document.css:5), [measurement](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/input-evidence.json). This does not prove failure of full-page zoom. | Let interface text inherit the browser root and reuse existing text tokens. Check enlarged-text layout before changing scientific canvas dimensions. |
| CI-04 / P2, source-supported | Evolution chart's image label states counts but omits axis arrangement and magnitude/phase encoding. Small step cards and the State panel provide some exact-value alternatives; the entire dataset is not proven inaccessible. [Source](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/algebra/evolution-chart.jsx:99). | Add a short structural/encoding description and identify the existing exact-value route. Add a bounded trend readout only if the task needs one; avoid thousands of hidden marks or a chart-library replacement. |
| FND-04 / P3, editorial | Export labels the shared circuit URL “Escaped link.” [Source](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/export/export-panel-body.jsx:64). | Rename it “Circuit link.” Keep scientifically meaningful terminology elsewhere. |
| FND-01 / P2 verification concern | A 256-entry State table rendered 24 rows, with no explicit paging controls. Scrolling rendered later rows correctly. Omitted rows cannot be read until rendered; whether VoiceOver navigation/scrolling provides practical complete access remains untested. [Source](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/state/state-panel.jsx:158), [measurement](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/browser-evidence.json). | First perform the large-state VoiceOver task. If access fails, add simple Previous/Next rows or a basis-row selector using current virtualization. Do not replace the table speculatively. |
| FND-03 / P3 verification concern | Custom theme code follows light/dark but has no explicit increased-contrast/forced-colors adaptation. Default contrast failure was not established. [Source](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/browser/systemColourScheme.js:5). | Measure actual controls/focus boundaries under the preference, then adjust existing neutral tokens where necessary. Preserve phase colors and numeric phase alternatives. |

Apple sources for these follow-ups: [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Charts](https://developer.apple.com/design/human-interface-guidelines/charts), [Writing](https://developer.apple.com/design/human-interface-guidelines/writing), [VoiceOver](https://developer.apple.com/design/human-interface-guidelines/voiceover), and [Color](https://developer.apple.com/design/human-interface-guidelines/color).

## Verification performed

| Check | Current result |
|---|---|
| Production build | Passed; Vite emitted its large-chunk warning. A warning alone is not a measured loading defect. |
| Existing production E2E suite | **116/116 passed**. [Full log](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/e2e.log). |
| Eight targeted browser experiments | Completed: Tape recovery, denied clipboard, State virtualization, responsive touch layout, dial accessibility range, composing Enter, Control-click, and default-font preference. [Browser evidence](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/browser-evidence.json), [input evidence](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/input-evidence.json). These are measurements/reproductions, not eight newly passing regression tests. |
| Responsive touch layout | No document overflow at 1280 → 768 → 390 → 320 → 1280px. Inspect remained 44px high. Default visible buttons in this sample were not below 28px on either axis. This is not a whole-app target-size certificate. |
| Working-tree integrity | Pre-existing file hashes compared before/after the review; review artifacts are the only authored additions. See [integrity record](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/integrity.json). |

The default Puppeteer launch first failed because expected Chrome 152 was absent. Tests and experiments then used the already-installed Chrome for Testing 154.0.8037.57 with an explicit executable path. No browser or package installation was needed. The fresh build and suite results describe the dirty working tree based on commit `8e8ac2742bf7fd7b845e4e7cc44fdd22718fa3e8`, not a clean HEAD checkout.

The two experiment scripts are retained in evidence for reproduction. They create fresh browser contexts and disposable test data. The initial [working-tree snapshot](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/baseline-status.txt) makes the review boundary explicit. Unit, performance, lint, and typecheck suites were not rerun for this review; no current result is claimed for them. `git diff --check` passed.

## Visual samples

Desktop after a narrow-to-wide layout transition:

![Quirk desktop at 1280px](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/layout-1280.png)

Touch-emulated 390px viewport:

![Quirk at 390px](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/doc/reviews/2026-10-05-apple-hig/evidence/layout-390.png)

The samples show the actual production interface used for measurements. The circuit remains a pannable scientific workspace; document-level fit does not imply all circuit content is visible simultaneously.

## Verification boundary

This audit considered all current HIG category/leaf text and platform subsections in the retrieved topic tree. It did **not** systematically inspect all 1,472 referenced Apple illustrations, execute linked WWDC videos or framework documentation, or test every possible Quirk state. Resource and changelog sections establish context; they are not additional feature requirements. The full DocC JSON was retained in the temporary source cache as authority where normalized text omitted inline code fragments.

Real Safari/VoiceOver sessions, physical iPad/iPhone/folded-device testing, actual CJK composition, Apple Pencil/Scribble, high-contrast preference propagation, full-page 200% zoom, and exhaustive cross-browser behavior remain unverified. Large-import/slow-network loading and hidden-tab resumption need measurement before they become defects. The coverage matrix explicitly distinguishes aligned scope, partial scope, confirmed gaps, non-applicable features, and unverified behavior; it is not an Apple compliance certification.

**Recommended first implementation:** add Tape deletion Undo, followed by correcting dial semantics. Both reuse existing infrastructure and protect users' work or access without redesigning the interface.
