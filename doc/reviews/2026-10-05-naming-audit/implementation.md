# Naming cleanup implementation

Implemented on 5 October 2026 after the user approved the [naming audit](README.md). Two GPT-6.1-Sol agents implemented gate and recording terminology; a third performed independent Ponytail review. The lead integrated product/documentation and probability wording, ran verification, and fixed the review's manual-reference finding.

## Delivered

- Replaced explicit toy positioning in package metadata and README with an interactive quantum circuit workbench description. Preserved small-circuit scope, prerequisites, upstream attribution, and measurement limitations. Rewrote the JavaScript fallback and screenshot alt text.
- Renamed four `Joke_` source modules and updated their import consumers. Public names now describe Zero operator, Amplitude negation, Random single-qubit unitary, and Scalar phase operators. Random-unitary sampling is not described as Haar-uniform. The Time-dependent powers category replaces Spinning.
- Replaced all 14 apologetic disabled annotations and the embedded-measurement “broken” message with concise operation restrictions. These restrictions retain their existing simulation meaning.
- Replaced the recording UI vocabulary consistently: Recordings, snapshot, automatic snapshot, collection. Updated menus, accessibility labels, loading/empty states, generated names, downloads, validation/storage messages, and current documentation. Existing saved names are not rewritten.
- Updated probability captions and Create gate controls, including the selection menu and manual. Compact canvas captions use “prob.” where space is constrained. Constrained the Recordings file input to its panel width after enlarged-font inspection revealed its native 722px intrinsic width at a 390px viewport.

## Compatibility

Exported APIs, serialized gate IDs (including Chance/ChanceN), gate matrices, alternates, IndexedDB/localStorage identifiers, schema tags and fields, CSV keys, and the URL `take` parameter are preserved. Legacy files, links, and saved layouts continue to use their existing contracts. Scientific terms such as magic-state distillation and little-endian are retained. No dependencies were added and no commit, push, or deployment was performed.

The [isolated patch](implementation.patch) is relative to the preserved pre-edit current tree, not the much larger pre-existing Git diff. The [hash manifest](evidence/changed-files.json) records 62 changed paths, counting each of the four file moves as an old and a new path. The pre-edit snapshot remains under `/tmp/quirk-bench-naming-fix-20261005/before`.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Unit suite | **1079/1079 passed**, exit 0 | [Unit log](evidence/unit.log) |
| Complete E2E suite | **126/127 passed**, one pre-existing Bloch layout failure | [E2E log](evidence/e2e.log) |
| Baseline reproduction | The same Bloch test fails with identical geometry against the pre-edit snapshot | [Baseline log](evidence/baseline-bloch.log) |
| Final focused E2E | **3/3 passed**: selection menu/bar, recording/import/export/reload, deletion recovery | [Focused log](evidence/focused-final.log) |
| Browser copy and bounds | Passed at desktop 1280px, touch 390px, and touch 390px with 32px preferred font | [Browser log](evidence/visual-final.log) |
| Production build | Passed; existing large-chunk warning remains | [Build log](evidence/final-build.log) |
| Source/test/tooling ESLint | Passed (`npx eslint src test test_e2e scripts`) | [Lint log](evidence/lint-final.log) |
| Knip | Passed | [Knip log](evidence/knip.log) |
| Scoped Impeccable layout detector | No findings (`[]`); not an accessibility certification | [Detector result](evidence/detector.json) |
| Independent source review | No unresolved naming/compatibility findings after manual references were corrected | Sol/Ponytail review of the snapshot-relative change and renamed gate pairs |

The full E2E run preceded the final file-input CSS constraint and selection-menu copy correction. The browser bounds checks cover the CSS correction; the focused E2E run covers the final selection-menu and recording flows. No simulation logic changed.

## Existing failure and limits

The failing E2E test is “Bloch sphere leads the panel with reachable controls and unbroken complex amplitudes” at `test_e2e/overlays.test.js:305`. At 390px, the 300×300px sphere is not entirely visible within the initial panel viewport. Both trees report `right:375`, `bottom:829`, `sphereVisible:false`, `presetsVisible:false`, and no horizontal overflow. This remains an outstanding layout issue; the naming change does not claim a clean full E2E suite.

Full-project ESLint retains the previously identified historical-audit-script errors. Typecheck was not rerun for these copy/module-path changes and remains advisory. Browser evidence is Chromium-based; native Safari/VoiceOver and physical-device behavior were not reverified.

## Rendered examples

- [Gate restriction and probability captions](evidence/disabled-gate.png)
- [Scalar palette names](evidence/scalar-palette.png)
- [Recordings on a phone-width viewport](evidence/recordings-390-16.png)
