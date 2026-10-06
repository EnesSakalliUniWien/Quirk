# Sidebar fixes — 2026-10-06

Resolved the two priority issues in `2026-10-06T16-19-58Z__src-components-toolbox-gate-toolbox-jsx.md`.

- Mouse drag starts after 6px movement. A click uses the existing circuit cursor/end placement path; it cannot drop at a coordinate exposed by changing tabs on pointerdown.
- Touch rows allow native vertical panning. A deliberate tap inserts once at the indicated destination and reveals Circuit.
- Pending mouse presses cancel on pointer cancellation, blur, and unmount. Post-drag clicks do not insert twice.
- Visible, associated keyboard/activation guidance shows the clamped circuit column and q-index, or the top-wire end fallback.
- Empty search results have a status role and Escape recovery hint.

Verification:
- Production build passed; existing large-chunk warning remains.
- 9/9 toolbox production E2E tests passed, including the two added regression cases for click/cancel and native synthesized touch swipe/tap.
- Scoped ESLint, Prettier and diff whitespace checks passed.
- Native browser inspected at 1280×720 and 390×844. Selecting column 1/q1, then clicking Hadamard produced `cols:[["X","H"]]`, matching the visible guidance.
- Physical touch hardware and VoiceOver were not tested. Touch evidence is Chromium input emulation.

Screenshots: desktop.jpg and phone.jpg.
