# Upper-bar polish — 2026-10-06

Scope: app branding/action toolbar and independent Steps/Time transport lanes.

- Added shared gutters and a subtle header boundary.
- Strengthened lane labels and separated Steps from Time.
- Kept Record visibly labeled at narrow widths; positioned it beside the readout on small touch layouts.
- Reused existing spacing, surface, border, and text tokens. No playback logic changed.

Verification:
- Production build passed (existing large-chunk warning remains).
- Scoped Prettier and JSX ESLint passed.
- 18/18 existing production E2E tests passed: toolbar, transport, keyboard navigation, and 320px touch target checks.
- Native browser visual inspection at 390, 600, and 1280 pixels passed. Saved desktop and phone previews show the final dark theme; the initial inspection also checked the light theme.
- Touch checks used browser emulation, not physical hardware.

Files: desktop.jpg, phone.jpg.
