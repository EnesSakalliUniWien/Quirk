# Apple guidance review: implemented fixes

Scope: the nine findings in `2026-10-03T12-43-38Z__src-components-app-jsx.md`, following Impeccable adapt, harden, clarify, onboard and polish. Existing scientific display semantics and independent Steps/Time controls remain the design authority.

| Finding | Result |
| --- | --- |
| F1 adaptive layout | Docked panels share one tab group at narrow widths. Wide arrangements and live drafts survive resizing. Retained hidden panels cannot enlarge the page. |
| F2 panel fit | Shared content follows panel width, with container-based padding. Export fields fit a narrow inspector. |
| F3 appearance state | System appearance updates in place, preserving undo, drafts, focus, playhead and paused t. Canvas, overview, tiles and scientific views repaint. |
| F4 discovery | A persistent labeled Inspect menu exposes six analysis panels and marks the active panel. Compact expert controls remain. |
| F5 parameter chooser | Chooser entry focus, Escape, Close and focus return are consistent. Its empty state explains what to add and offers a path to gate search. Visibility is tested as well as focus. |
| F6 learning route | Superposition, Interference and Bell Pair lead the examples menu, with expected observations. Starter selection fits the circuit and remains undoable. |
| F7 touch targets | Coarse pointers receive larger buttons and menu targets. The smallest phone layout gives playback commands their own row. |
| F8 scrub cancellation | Pointer cancellation, lost capture, release outside the slider and window blur clear the dragging state. |
| F9 landmark | The workspace is a named main landmark. |

## Verification

- Unit suite: 1,067/1,067 passed.
- Production end-to-end suite: 116/116 passed.
- Performance suite: 7/7 passed.
- Final production build passed. Its last containment correction was verified by 2/2 dock tests against that build.
- ESLint, Knip and `git diff --check` passed.
- Typecheck remains failing on existing repository diagnostics. Comparison with an untouched HEAD archive found no newly introduced failures after normalizing shifted lines and an improved icon type annotation: 4,679 diagnostics at HEAD, 4,659 after changes; dependency diagnostics unchanged.
- Independent agents reviewed theme/state preservation and layout/gesture integration. Their concrete findings were corrected and regression-tested.
- Native browser visual checks covered desktop, 600px and 390px layouts, starter examples, Export and the empty chooser. Automated touch emulation covered 320px controls and gate drag cancellation. Screenshots are stored alongside this record.

The initial full browser run exposed test assumptions about Dockview's former DOM nesting and touch geometry measured before touch emulation. Tests now locate panel tabs by identity and establish the viewport before measuring. No assertions were disabled.

Limits: no physical mobile device, full screen-reader session, or exhaustive cross-browser certification. Apple research is the relevant 33-article HIG survey and WWDC25 session 208 catalog in `../research/apple-hig-rules-2026-10-03.md`, not a claim to have crawled every Apple developer page. The production build retains its existing large-chunk warning.
