> Integration note: the consolidated README is the final ranking and verification authority. Agent findings retain their original IDs; PAT-02 and CI-01 are one issue, and FND-01 remains a VoiceOver verification concern. Current root measurements are linked in the README.

# Components and Inputs audit

Reviewed the current dirty Quirk source against the live Apple HIG inventory fetched 2026-10-05: 73 Components pages (including eight group pages) and 14 Inputs pages. Coverage is scoped to a scientific browser application. Native Apple integrations and absent product features are not an implementation backlog. No application/test code was changed and no passing test claim comes from historical work.

## Findings

### CI-01 [P2] Export copy results disappear before users can reliably perceive or recover from them

[src/components/panels/export/copy-button.jsx:4](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/export/copy-button.jsx:4), `:19-24`, `:32-34`: all Export copy controls share a one-second result timeout; the result span is neither a status/live region nor associated with the focused button. Clipboard failures show only “It didn’t work…” and then vanish. A keyboard/VoiceOver user receives no reliable outcome, and someone reading slowly can miss the failure. The export JSON/CSV text remains available, so report the recovery path explicitly.

Apple: [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) describes communicating delayed action status, and [Labels](https://developer.apple.com/design/human-interface-guidelines/labels) calls for useful error information. This also intersects Feedback/Accessibility owned by the other audits. Minimum fix: reuse the existing `notify` helper in [src/components/ui/toasts.jsx:22](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/ui/toasts.jsx:22), which already provides persistent dismissible feedback through Base UI; remove the independent timer/result lifecycle. Failure copy can say that clipboard access was denied/unavailable and that the shown text can be selected and copied. Do not introduce a clipboard abstraction or new dependency.

Verification: root live browser denied clipboard access and confirmed result text, null role/live/parent-live/describedBy, and blank text after 1200 ms. Actual VoiceOver speech remains untested. Current tests do not establish announcement behavior.

### CI-02 [P2] Rotation dials publish the wrong accessible range

[src/components/panels/circuit/wire-dial.jsx:157](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/circuit/wire-dial.jsx:157) declares a custom slider with `aria-valuenow` but omits min/max. The control deliberately permits negative angles and multiple full turns; its End key sets 360 (`:138`), and its drag/arrow paths continue past full turns. [WAI-ARIA slider](https://www.w3.org/TR/wai-aria-1.2/#slider) assigns implicit bounds 0 and 100, so the accessible widget misrepresents common values such as 180, 360, 720, and negative rotations. `aria-valuetext` helps speech but does not correct the range semantics.

Apple: [Sliders](https://developer.apple.com/design/human-interface-guidelines/sliders) explicitly permits circular sliders whose values repeat or continue indefinitely, including 1440 degrees. [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards) requires keyboard access; [Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection) emphasizes standard interactions. Minimum fix: expose this unbounded numeric adjustment with semantics that support absent bounds (for example, spinbutton with the existing value and degree text), and align its keyboard behavior with that role. Keep all scientific angle values and full turns; do not clamp the model to 0–360 merely to satisfy slider semantics. The existing parameter editor remains the exact text-entry alternative.

Verification: root Chrome accessibility-tree check reports DOM180 and720 degrees as slider value100, and DOM-90 degrees as value0, with min0/max100. Evidence: input-evidence.json. Live W3C specification check confirms the defaults. Native VoiceOver adjustment still needs testing.

### CI-03 [P2] Register rename intercepts IME confirmation/cancellation as app commands

[src/components/panels/circuit/rename-box.jsx:55](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/circuit/rename-box.jsx:55) applies and closes on Enter and discards on Escape without checking `event.nativeEvent.isComposing`. These keys are also used while confirming/canceling an input method composition. The Registers row has the same Enter interception at [src/components/panels/registers/register-row.jsx:85](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/registers/register-row.jsx:85). By contrast, MathField and Forge/Gate parameter editors already guard composition. The register-name model intentionally restricts identifier characters, so this finding does not request changing accepted names; an IME can still be active while supplying Latin identifier text.

Apple: [Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields), [Virtual keyboards](https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards), and [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards) call for expected text-entry behavior. Minimum fix: use the existing composition-guard pattern before consuming Enter/Escape in these fields. Do not create a global keyboard framework.

Verification: root synthetic browser event had isComposing=true, became defaultPrevented=true, and closed the rename editor. Evidence: input-evidence.json. Exact CJK IME/event ordering across Safari/macOS and iPadOS needs native verification.

### CI-04 [P2] Evolution chart does not describe its encoded quantities to assistive technology

[src/components/panels/algebra/evolution-chart.jsx:93](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/algebra/evolution-chart.jsx:93) provides a generic label “How each of the … amplitudes changes over … steps”; the visible step/basis labels are hidden from accessibility. [src/components/math/data-view.jsx:77](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/math/data-view.jsx:77) publishes the canvas as one image with no fallback description or mark/group data. VoiceOver can learn how many amplitudes/steps exist, but not the complex amplitude magnitude/phase changes or even the axis arrangement. Small step cards provide MathML values and the State panel offers values at the current playhead, which mitigate individual-value access; neither is identified by the chart as its equivalent nor supplies the chart overview. At larger sizes `StateFactor` also falls back to a generic canvas.

Apple: [Charts](https://developer.apple.com/design/human-interface-guidelines/charts), specifically Enhancing the accessibility of a chart, asks for an overview of purpose/structure/axes and meaningful labels for important elements or groups. It permits grouping dense data, so millions of hidden DOM points are unnecessary. Minimum fix: add a concise chart description explaining the axes and magnitude/phase encoding and refer to the existing State/step readouts for exact values; add a bounded accessible selected-step or selected-basis trend readout if the overview needs actual change values. Keep phase scientifically distinct from magnitude and retain the shared renderer. No charting library replacement.

Verification: current source confirms missing overview and generic image semantics. Browser accessibility tree and real VoiceOver task completion remain unverified.

### CI-05 [P2] macOS Control-click does not reveal the circuit context menu

[src/app/canvas/canvasPointer.js:429](/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/app/canvas/canvasPointer.js:429) opens menus only through Pixi rightclick; `:379-390` only suppresses native menus after a button2 press. A macOS Control-primary-click emits button0 and follows the ordinary drag path (`:257`) instead. Root Chrome live check on the same X gate produced pointerdown0/Ctrl, contextmenu0/Ctrl, pointerup0/Ctrl with no app menu, while button2 right-click opened the app menu; circuit hash stayed unchanged. This proves missing menu access, not content loss.

Apple: [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus) explicitly lists Control-click as standard macOS/iPadOS access. [Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices) calls for consistent familiar inputs. Minimum fix: route Apple-platform Control-primary-click through the existing context-menu opening path and exclude it from the ordinary drag before it starts; reuse the existing target hit-test/openMenuAt handler. Keep intentional modified drags on other platforms. Verify Safari and external-pointer iPadOS event sequences separately. Evidence: input-evidence.json.

## Positives supported by current source

- Menus use installed Base UI primitives for trigger/popup/item/radio behavior. The installed slider thumb supplies native input min/max properties, so its numeric Bloch sliders do not share the custom wire-dial range issue.
- Context menus are short, relevant, grouped, label destructive deletion, omit shortcut clutter, and have equivalent selection-bar/parameter/register controls. Gate/selection keyboard menus explicitly restore focus to the circuit. Browser runtime behavior remains to be verified.
- Buttons have accessible names, focus/press styles, and 44 px coarse-pointer sizing; menu items also get 44 px coarse-pointer hit regions. Desktop 32 px icon controls are a density choice; native Apple pt guidance is not a blanket web pixel defect.
- Toolbar keyboard roving focus, platform-specific undo/redo, custom circuit arrow navigation, shift selection, menu key, Delete and clipboard commands are implemented. Typing targets use composed paths and include MathLive.
- Gate search uses native type=search, an accessible name, immediate filtering, grouped content, an empty-result message, Escape clear, and keyboard row movement.
- Probability data is actual semantic tables with header scope, step seek buttons, numerical values, shared scale explanation, and noncolor up/down arrows. State table labels nonzero amplitudes, exposes row positions for virtualized rows, and separates measured/deferred scientific semantics.
- Steps and Time are separate groups with native range inputs and independent speeds/nudges; changing one is not an excuse to couple the two. Continuous time is not a task progress indicator.
- Dock layout adapts to narrow widths, remembers arrangements, restores essential panels, bounds floating panels, and uses an existing installed dock dependency. Do not replace it to imitate an NSWindow.
- Gate detail popover suppresses the hover preview while details are open; exact matrix/diagram details have a separate accessible button. Compact-device popover layout still requires runtime inspection.
- Formula entry uses labeled MathLive fields with live validation and unit conversion preserving exact text across unedited round trips; its keyboard aids fit mathematical input.
- Clear circuit and Clear all are reversible revision commits (`CircuitActions.js:66-75`); HIG Alerts explicitly discourages confirmation for routine undoable destructive actions. Do not add blanket confirmation dialogs.

## Verification gaps and applicability boundaries

No physical iPad/iPhone/Safari, VoiceOver, Full Keyboard Access, Apple Pencil Scribble, external pointer, visionOS eye targeting, TV remote, or Watch hardware was exercised by this subagent. Reading an installed library implementation proves available semantics, not that every composed app usage works at runtime. Root owns live browser reproduction and current full test execution.

System experiences (App Shortcuts, widgets, complications, Controls, Live Activities, snippets, Watch faces, TV Top Shelf, native notifications/status bars), native menu bar/Dock entries, and hardware inputs are out of product scope. The browser owns native windows, system edit menu/text behavior, and much Scribble/pointer integration. Selection/input components for absent features (color/image wells, PIN entry, date pickers, combo/token/path fields, ratings, media lockups) are N/A. Actual gate choices use existing flat menus/lists; no need to build these components for taxonomy completeness.

Latest leaf/platform sections were considered for applicability including June 8, 2026 Search fields refinement, June 2026 visionOS Look to Scroll guidance, Liquid Glass guidance, Apple Pencil hover/double-tap/squeeze/barrel-roll/Scribble, Vision Pro Crown and eye interaction, tvOS focus/remotes, and system-widget rendering modes. Native appearance or API prescriptions do not require this web app to acquire native system integrations. Full native conformance is not asserted.

Coverage limits: page/platform prose and JSON inventory were assessed for applicability; Apple instructional illustrations were not systematically visually inspected, and the crawl’s normalized text omits some inline code fragments. Native-only prescription was rejected at the applicability boundary rather than requiring exhaustive API implementation analysis. E2E116/116 current passes reported by root provide functional regression evidence, not HIG conformance.
