# Apple design research for Quirk — 2026-10-03

Scope: complete WWDC25 session 208 transcript; its three linked HIG articles; broad relevance-based HIG survey of layout, navigation, commands, input, feedback, reversible editing, and transient views. This is not a claim to enumerate every Apple developer page. All sources are official Apple pages. Native-only TV, Watch, spatial computing, and OS window-management prescriptions were read where present but excluded from web requirements.

Method: HIG HTML returns a JavaScript shell. Complete DocC source was retrieved from `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`. Each audited source has `/tmp/apple-<slug>.json` plus a readable `.txt`; JSON retains tables and metadata. The original three text files omit tables, so inspect their JSON. `/tmp/apple-wwdc208-transcript.txt` records exact transcript timestamps. This is source research, not verification of Quirk behavior.

## Interpretation and conflicts

- Transfer functional principles to the browser; do not imitate native traffic lights, OS menu bars, pointer magnetism, or system glass indiscriminately.
- The session recommends additive per-document windows for native multitasking. Current Windows guidance limits automatic new windows to useful workflows. Web implication: preserve work and offer explicit independent documents/tabs when useful; automatic popups are not established as necessary.
- Regular and menu-bar menus retain unavailable commands, dimmed. Context menus instead hide unavailable commands, with native macOS clipboard exceptions. These are distinct rules, not a contradiction.
- The live Pointing devices article retains 2023 circular-cursor/magnetism/morphing descriptions. Session 208 explicitly supersedes those for iPadOS 26. Retain general input principles from the article, not its older cursor behavior.
- Session 208 encourages a symbol per item; the June 2026 Menus article refines this to meaningful icons, consistent within a group, and no forced ambiguous symbol. Prefer current detailed guidance.
- Tab bars navigate between app areas; toolbars operate on current content. A gate palette is not automatically a navigation sidebar, and tool categories are not automatically app tabs.
- Native keyboard guidance delegates some control traversal to Full Keyboard Access. For the browser, use semantic controls, sensible focus, keyboard operability, and host-browser conventions; do not interpret this as permission to remove web keyboard navigation.
- Points, platform button positions, native animations, and system APIs are contextual native specifications. Browser application requires explicit judgment, not numerical copying.

## Session 208: complete recommendation index

Source: [Apple guidance](https://developer.apple.com/videos/play/wwdc2025/208/)

- Navigation, 1:25: match structure to content; sidebars expose many/deep destinations; tabs conserve space; allow adaptable representations. Adapt to available width, collapse columns when useful, preserve layout state, and restore it when space returns. Extend content around navigation with legibility preserved.
- Windows, 4:58: accommodate native window controls inline; preserve document context through additive opening; supply descriptive unique document-window titles.
- Pointer, 8:40: direct input tracking; individual-target hover feedback; test precision behavior. No iPadOS 26 magnetic capture.
- Menu bar, 10:24: relevant commands, frequency ordering, related groups, secondary submenus, consistent symbols, frequent-action shortcuts, View navigation/toggles, persistent menu structure with disabled unavailable actions.

Timestamp URLs append `?time=85`, `?time=298`, `?time=520`, or `?time=624`.

## Layout and navigation

### Layout
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/layout)

Prioritize content in reading order; use alignment, indentation, whitespace, and grouping to convey relationships. Disclose complexity progressively. Distinguish controls from content. Respond to actual available width/height, not device labels or orientation alone. Handle narrow/wide and short/tall combinations, text enlargement, localization, RTL, external displays, and safe areas. Preserve functionality as space changes; change visibility and presentation instead. Enlarge containers or stack content rather than clip text. Test smallest/largest layouts and translated/enlarged text. Preserve artwork proportions. Native glass, background-extension, and layout APIs are implementation-specific; readable control/content separation transfers.

### Tab bars
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars)

Use tabs for distinct destinations, preserve navigation state within each, and keep navigation available except when covered by a temporary modal. Minimize unnecessary tabs and avoid overflow hiding important destinations. Do not hide or disable empty destinations: explain the empty state. Use short labels and familiar scalable icons; maintain contrast against content. Reserve badges for critical updates. Customization can expose frequently used destinations; native iPad guidance suggests five or fewer defaults when customizable. Use a sidebar for genuinely richer hierarchies. Neither tabs nor a five-item limit is universally mandatory for a browser editor.

### Sidebars
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/sidebars)

Use only when hierarchy benefits justify its space. Group/disclose long hierarchies, generally exposing at most two levels; deeper structures can use additional panes. Provide concise section labels and meaningful symbols. Permit customization when useful. Let people hide/reveal navigation with discoverable controls; do not initially conceal essential navigation. Adapt visibility to width while preserving user context. Color should convey meaning rather than decoration. Native mirrored background extensions are optional platform treatments, not required for a canvas tool palette.

### Split views
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/split-views)

Clarify relationships through persistent selection in upstream panes. Support logical navigation when panes collapse at intermediate/narrow widths. Use readable minimum sizes and visible, operable dividers; allow hiding supporting panes where this expands editing space. Provide multiple ways to restore them, including commands/shortcuts. Support cross-pane dragging when useful. Native macOS recommends thin dividers, but browser hit areas must remain practical. Supplementary editing panels are a valid split-view use, even without a navigation hierarchy.

### Toolbars
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/toolbars)

Prioritize primary/frequent actions; avoid default overcrowding; define overflow priorities. Consider customization for complex long-lived tools. Group by function and frequency, generally in at most three groups; visually distinguish navigation and critical completion actions. Keep important controls accessible as width shrinks. Use unambiguous familiar symbols or text when needed; separate adjacent text/symbol controls to avoid false grouping. Use one emphasized primary completion action. Titles identify content/location, not merely the app name. Restore hidden toolbars reliably. Keep command placement consistent. Menu access complements customizable toolbars. Native automatic overflow, concentric geometry, glass, and exact leading/center/trailing roles are contextual. The transferable concern is hierarchy, legibility, and reliable access—not an obligation to suppress labels.

### Search fields
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/search-fields)

Clarify searchable scope, offer clear/reset, and refine results as typing permits. Rank relevant results first; use categories, suggestions, and filters when helpful. Start broadly before refinement; make tokens discoverable/editable. Put scoped search beside its content; use a toolbar for broader scope or a dedicated area for discovery. Preserve contextual usefulness through resizing. Avoid automatically raising a touch keyboard just to show a search area. For Quirk, gate search and circuit search may have different scopes; adding either is a product judgment.

### Scroll views
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/scroll-views)

Respect standard scrolling and keyboard behavior. Make overflow evident; avoid nested same-axis scrollers. Preserve context when paging. Auto-scroll only enough to expose search results, editing targets, selections, or drag destinations. Set useful zoom bounds. Native scroll-edge treatments separate floating controls from scrolling content, not decoration: one coherent effect per view and aligned effects across panes. Browser relevance includes discoverable canvas/palette overflow and avoiding accidental competition between page and canvas scrolling.

## Commands and menus

### Menus
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/menus)

Use concise action labels; ellipses indicate additional input. Use familiar action icons only when meaningful, with all-or-none icon treatment within groups. Prioritize frequent commands while keeping related commands together. Separate logical groups. Avoid excessive length, except naturally user-generated lists. Use submenus sparingly, generally one level; reconsider submenus beyond roughly five items. Leave regular menus and submenus openable even when their commands are disabled. Prefer submenus over indentation. Toggle labels should express the action unambiguously; checkmarks show current attributes. Consider a way to remove several related attributes together. Native title capitalization and menu layouts are platform conventions rather than automatic web requirements.

### Context menus
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/context-menus)

Show a short set of currently relevant, frequent actions. Offer every action in the visible/main interface too; hidden context access is supplemental. Apply context menus consistently to comparable objects. Hide unavailable actions, except native macOS clipboard cases. Prefer a single submenu level, intuitive submenu titles, and no more than about three groups. Prioritize near the invocation point; native placement can reverse reading order. Avoid shortcut clutter here; advertise shortcuts in primary menus. Use familiar icons and concise labels; add a menu title only when it clarifies scope, such as a multi-selection count. Put destructive actions last and identify them. Touch previews should confirm the target. Native edit/context gesture conflicts matter for native implementations; web equivalents require interaction testing.

### Menu bar
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar)

Native app menus follow familiar scope/order, standard shortcuts and icons, short titles, and stable disabled command placement. Expose important and advanced app commands. View controls appearance; Window manages windows; File closes documents. Use truthful visibility toggles and descriptive undo actions. Dynamic modifier commands need another discoverable route. iPad functions require in-app access despite hidden OS menus; system Settings differs from internal preferences. Tables additionally specify recognizable recent document names, autosave, explicit duplication/export semantics, and concise help. Browser inference: organize a discoverable command surface with familiar terms; do not recreate the entire OS menu bar or duplicate unavailable system operations.

## Input and editing

### Pointing devices
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/pointing-devices)

Keep mouse/trackpad/touch/keyboard interactions consistent; preserve system gestures. Modifier-assisted operations should mean the same across input modes. Pointer support supplements touch. Provide multiple selection where useful and differentiate input types only for a real benefit. Use standard cursor semantics and practical hit regions. Avoid decorative or confusing cursor changes and instructional text attached to the pointer. Useful domain annotations—coordinates or dimensions—can help. Hover scaling must not collide with adjacent controls. Restore minimized controls through pointer interaction. IMPORTANT: the article's older native iPad magnetism/circular-pointer sections conflict with the session and must not be treated as current iPadOS 26 advice.

### Keyboards
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/keyboards)

Support keyboard-only use and assistive access; respect standard shortcuts. Add shortcuts mainly for frequent domain actions, advertise them clearly, and avoid unrelated modifications of familiar shortcuts. Preserve standard text-editing and selection behavior. Respect localized layouts and RTL. Native conventions favor Command as primary modifier, Shift for related variants, Option sparingly, and reserve many Control combinations for system use. For browser Quirk, translate this to platform-appropriate shortcuts and respect browser reservations; neither global key interception nor copying all native shortcut assignments follows from the source.

### Gestures
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/gestures)

Offer alternative inputs for every important action. Honor familiar tap, drag, swipe, zoom, and rotate meanings; respond immediately with predictive feedback. Explain unavailable interaction states. Custom gestures should be necessary, discoverable, simple, distinct, easy to teach, tested in actual use, and never the sole route to important functionality. Shortcuts supplement visible controls. Do not conflict with system edge gestures. Native multi-finger undo/copy and spatial gestures should not be redefined or blindly ported to browser canvas interactions.

### Drag and drop
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop)

Support dragging consistently and provide alternatives. Make move/copy semantics predictable; offer multi-item operations when valuable and undo. Preview the dragged content and prospective valid destination continuously; clearly reject invalid drops. Avoid excessive preview changes. Auto-scroll useful destinations, stopping when the drag leaves them. Accept the richest supported representation and relevant data; provide progress/placeholders for transfers and feedback for triggered actions. Preserve appropriate styling and destination selection. Evaluate copy modifiers at drop time. Export interoperable representations when useful. Native inter-app defaults do not override domain semantics: palette-to-circuit insertion and moving an existing gate are different operations that should communicate their result.

### Undo and redo
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo)

Describe the action that will reverse; reveal/highlight the actual result, including offscreen changes. Support multiple steps without arbitrary small limits. Group related incremental edits when useful and consider larger reversion boundaries. Use conventional shortcuts and Edit menu placement; visible toolbar buttons are appropriate when needed for discoverability/access. Do not redefine native undo gestures. Browser Quirk should make circuit edits reversible and clarify history boundaries; whether simulation time or navigation belongs in edit history needs domain-specific judgment.

## Feedback, context, and transient views

### Feedback
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/feedback)

Match interruption to significance. Place routine status near its subject and make feedback accessible through more than color alone. Reserve alerts for critical actionable information. Warn about unexpected irreversible loss, not every intended deletion. Confirm significant completion when useful; explain failed or unavailable commands and help people recover. For Quirk, loading, invalid circuits, unsupported operations, and completed exports should differ in presentation according to consequence.

### Alerts
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/alerts)

Use sparingly for essential actionable interruption; prefer inline status for information and startup problems. Do not alert for ordinary undoable deletion. Use neutral, specific titles and only helpful explanation. Label outcomes with concise verbs, avoiding ambiguous Yes/No/OK confirmations. Provide a clear cancellation route, including Escape where appropriate. Make destructive consequences clear; platform styling distinguishes deliberately requested destruction from unexpected consequences. Avoid a default action when deliberate reading is essential. Keep dialogs short and avoid unnecessary scrolling. Native sheet/alert positioning and button ordering require platform interpretation.

### Popovers
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/popovers)

Use for temporary contextual information/actions. Anchor to the invoking control without covering it or essential content. Automatically dismissed nonmodal popovers preserve work; discard only through explicit cancellation. Keep multi-select popovers open until dismissed. Show one at a time, avoid cascades/overlays, and permit direct switching between invoking controls. Size to content; transitions should preserve continuity. Use explicit close/confirmation controls only when they clarify meaning. Warnings belong elsewhere. Compact layouts may need a fuller modal presentation. Browser inspectors/popovers should retain semantic focus and dismissal behavior appropriate to the web.

### Sheets
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/sheets)

Use for brief focused tasks; use other structures for prolonged editing or repeated input-and-observe workflows. Avoid stacked sheets. Supplementary controls that affect an ongoing task should be nonmodal. Clarify Cancel/Close versus Done versus Back; provide a way out without forced completion. Protect unsaved work during dismissal. Native resizable sheets expose a grabber, appropriate detents and accessible resizing; these are optional native mechanics. For browser Quirk, a persistent inspector may better serve repeated parameter changes than a blocking dialog.

### Windows
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/windows)

Adapt fluidly, preserve context when opening separate content, and provide explicit new-window options where useful without excessive automatic windows. Use system window controls rather than imitations. Separate main application views from task-specific auxiliary views. Native window-state visuals and toolbar safe areas belong to the host. Web implications concern readable resizable layouts, meaningful document titles, preserved editing state, and intentional document opening.

### Multitasking
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/multitasking)

Prepare to save/restore context at any time. Pause participation-dependent experiences appropriately; finish user-started independent tasks when possible. Distinguish long audio interruptions from brief ducking. Notify only for meaningful/time-sensitive completion. Adapt to available space without assuming control of other windows. A simulation/editor must explicitly choose what pauses, continues, or catches up after being hidden; this source does not prescribe silently discarding user work or pausing every background calculation.

### Managing notifications
Source: [Apple guidance](https://developer.apple.com/design/human-interface-guidelines/managing-notifications)

Obtain permission, represent urgency accurately, and respect focus/delivery preferences. Reserve time-sensitive interruption for genuinely immediate relevance. Marketing requires explicit agreement and cannot claim time-sensitive urgency. Let people manage preferences. For a local scientific editor, do not add OS notifications merely because the platform offers them; ordinary in-app progress generally needs no notification service.

## Coverage inventory

Full relevant primary pages read: layout; tab-bars; sidebars; split-views; toolbars; search-fields; scroll-views; menus; context-menus; the-menu-bar; pointing-devices; keyboards; gestures; drag-and-drop; undo-and-redo; feedback; alerts; popovers; sheets; windows; multitasking; managing-notifications. Also inspected navigation-and-search, which is a topic index linking path controls, search fields, sidebars, tab bars, and token fields rather than an additional guidance article.

The complementary visual/accessibility survey follows below: design-principles, accessibility, color, typography, motion, materials, charts, charting-data, dark-mode, writing, and buttons. Combined coverage: 33 substantive HIG articles plus WWDC25 session 208; navigation-and-search was also inspected as an index.

Not promoted into requirements: unrelated Watch/TV/spatial layouts, gaming controls, native API integration details, OS-level window controls and menu extras. Further drill-down should follow an actual Quirk issue, rather than fabricate requirements from every linked platform page.


# Foundations and scientific display guidance

Reviewed 2026-10-03 from Apple's live official DocC articles, including relevant web-transferable recommendations. Native APIs are examples, not requirements for this browser application. Each group below links its primary source.

## Design principles
[Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)
- Focus on the task people came to accomplish; emphasize the core circuit-building and understanding workflow.
- Preserve freedom to explore, escape, undo, and recover without losing work.
- Use familiar concepts, consistent interactions, and clear availability and progress feedback.
- Preserve context across sizes, platforms, and input methods; include accessibility from the beginning.
- Establish hierarchy and concise language. Simplicity retains necessary power while reducing unnecessary choices.
- Make craft and delight serve the work; validate in real use rather than adding decoration.
Application: retain Quirk's quantum notation, independent clocks and useful inspectors; improve the shell around them.

## Accessibility
[Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- Provide perceptible, understandable, adaptable controls; information must survive loss of color, motion, audio or a particular input method.
- Support enlarged text, ideally at least 200%; verify legibility and foreground/background contrast in supported appearances.
- Label custom controls and scientific content for assistive technology; provide meaningful navigation order and keyboard operation without overriding system shortcuts.
- Make targets and spacing comfortable; use simple gestures with explicit alternatives.
- Avoid timed disappearance of information people need to read. Give playback controls and reduce automatic/repetitive motion when requested.
- Test assistive technology support rather than inferring it from ARIA alone.
Native sizing distinction: the current HIG table lists iPad 44×44 pt default and 28×28 pt minimum, versus macOS 28×28 and 20×20. These are not CSS-pixel WCAG thresholds. Quirk's 32px controls are a touch-comfort issue, not automatically a WCAG failure.

## Color
[Color](https://developer.apple.com/design/human-interface-guidelines/color)
- Use color consistently for the same meaning; avoid conflating data, interactivity and decoration.
- Pair color with symbols, shapes or words. Keep phase, probability and selection distinguishable without hue alone.
- Use semantic roles and appropriate light/dark/high-contrast variants; test under varied backgrounds, lighting and displays.
- Reserve strong accent emphasis for a small number of important actions. Scientific content can carry rich color while controls remain restrained.
- Choose colors by role, not by copying platform RGB values; account for transparency and color-profile differences.
Application: preserve phase hue, numeric phase, magnitude geometry, legends and shared color tokens across DOM/canvas.

## Typography
[Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- Use legible sizes and regular-or-stronger weights, a limited family set, and a stable hierarchy.
- Test custom fonts and mathematical notation at real viewing sizes; Apple does not require replacing a legible custom font with San Francisco.
- Preserve hierarchy as text grows; reflow, stack and reduce secondary material instead of clipping key content.
- Prefer useful wrapping over truncation, with adequate line spacing. Keep important controls reachable at large text sizes.
Application: DOM text zoom and scientific canvas labels both need testing; the current review did not run a 200% text-only enlargement test.

## Motion
[Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- Animate to explain state and continuity, briefly and predictably; avoid frequent decorative movement.
- Follow the user's gesture and allow interruption instead of delaying the next action.
- Make motion optional and preserve information with static feedback.
Application: Quirk's reduced-motion clock pause, manual play/scrub, and immediate Bloch transitions are meaningful adaptations. Do not remove essential t evolution merely to eliminate animation, or report the CSS transition override as the whole implementation.

## Materials
[Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- Distinguish controls/navigation from content through hierarchy and legibility.
- Liquid Glass belongs mainly to a functional layer; it should not cover the scientific content layer or be applied indiscriminately.
- Use custom effects sparingly. Prefer more opaque material where dense text needs contrast; clear material is intended for rich media backgrounds.
- Respect contrast/transparency preferences and evaluate the actual background under translucent controls.
Application: glass is an optional native material, not an obligation to add CSS blur to Quirk's matrices, circuit or plots.

## Charts
[Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- Choose visual marks and scale bounds according to what the data means. Use stable bounds when a physical range such as probability 0–1 is meaningful.
- Provide descriptive titles, units, axes, legends and a hierarchy that lets data lead.
- Do not require hover or color perception to obtain essential results; expose values and context to assistive technology.
- Keep compact plots readable and use comfortable hit regions, keyboard traversal and logical value grouping.
- Indicate changed values/scales through more than animation; avoid visual interpretations that exceed the actual values.
Application: probability, complex amplitude and Bloch projections need distinct semantics, exact numeric alternatives, and visible reference conventions.

## Charting data
[Charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data)
- Use a chart to communicate relationships; use searchable/sortable tables when exact data retrieval is the task.
- Reveal complexity progressively rather than packing every available encoding into one view.
- Explain unfamiliar representations; size the display for its data and interactions.
- Keep related views of the same dataset consistent in notation, colors, descriptions and visual identity.
Application: keep State's exact values alongside canvas plots. Explain the amplitude grid's magnitude, probability and relative phase without requiring the user to decipher all encodings at once.

## Dark Mode
[Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- Follow the system appearance and respond when it changes during use.
- Use semantic foreground/background roles with appropriate elevated surfaces rather than simple inversion.
- Test text, controls, artwork and scientific content in both modes and with contrast/transparency preferences.
Application: the present palette system supports both appearances; reloading to change theme disrupts session state. Update appearance without losing drafts, undo history or transport state.

## Writing
[Writing](https://developer.apple.com/design/human-interface-guidelines/writing)
- Use consistent terminology, concise labels, active verbs and a voice appropriate to the situation.
- Put the most important instruction first, describe the actual input method, and avoid unnecessary implementation jargon.
- Give empty states an actionable next step, and errors a nearby, blame-free explanation of recovery.
- Label fields persistently, use hints for expected formatting, and maintain consistent capitalization patterns.
Application: improve 'Escaped link' and the parameter chooser's contradictory choose/no-gates instructions; keep technical precision where it helps scientific work.

## Buttons
[Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- Make purpose clear using familiar icons, short text or both; use text where a symbol is ambiguous.
- Provide pressed, unavailable and focus states, with ample target spacing.
- Emphasize only one or two main actions; use visual style rather than arbitrary size changes to express priority within a peer group.
- Keep destructive actions distinguishable and avoid assigning them the default primary action.
- The button article recommends a general 44×44 pt hit region; read this alongside the platform-specific Accessibility table rather than calling it a universal web conformance test.
Application: expose named inspection routes while retaining compact desktop accelerators; add comfortable touch targets without forcing large desktop chrome.
