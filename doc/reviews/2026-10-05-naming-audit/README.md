# Quirk-Bench product-language audit

Audit captured: 5 October 2026. The findings below preserve the pre-edit inventory. The user subsequently approved the fixes; see the [implementation and verification report](implementation.md).

Audience: circuit-literate learners and researchers. The objective is precise, credible language, without implying validation, scale, or production readiness that the software has not demonstrated.

## Scope

Inspected current source, package metadata, HTML, README, product brief, manual, contributor documentation, scripts, test names, filenames, and historical text documents. The lead inspected documentation/metadata and a separate GPT-6.1-Sol/Ponytail reviewer inspected application language. Matches were traced to actual usage; keyword matches alone were not treated as findings. Dependencies, generated build output, Git history, screenshot text/OCR, remote GitHub descriptions/topics, and deployed-site metadata were not audited. This is a source-based inventory of identified wording, not a guarantee that every subjective impression has been captured.

## 1. Direct product-positioning and tone findings

| Location | Current wording | Recommended replacement |
| --- | --- | --- |
| `package.json:4` | “A drag-and-drop toy for exploring and understanding small quantum circuits.” | “An interactive workbench for constructing, simulating, and inspecting quantum circuits.” |
| `README.md:5` | “a toy quantum circuit simulator, intended to help people in learning about quantum computing” | “a browser-based workbench for constructing, simulating, and inspecting small quantum circuits” |
| `README.md:16–18` | “If you're still trying to understand what a quantum circuit even is, then I recommend…” | “Prerequisites: familiarity with qubits and quantum gates. For an introduction, see…” Preserve the educational resource. |
| `README.md:31` | “measurement is implemented as a hack” | “The simulator uses a deferred-measurement implementation and does not support restoring coherence to measured qubits.” Preserve the limitation and existing reference. |
| `index.html:20–21` | “You appear to have JavaScript blocked. And Quirk-Bench is made out of JavaScript... :(” | “Quirk-Bench requires JavaScript. Enable JavaScript in your browser to open the circuit workspace.” |

The first two are explicit toy positioning. The remaining three are tone/precision findings, not claims that an approachable explanation makes software unprofessional.

## 2. Gate labels and descriptions

| Location | Current wording / exposure | Recommended replacement |
| --- | --- | --- |
| `src/gates/misc/Joke_ZeroGate.js:24–25` | “Nothing Gate”; “Destroys the universe.” Both visible in the Scalar group. | “Zero operator”; “Maps all amplitudes to zero. This is a nonunitary operator.” Do not imply that its output is a normalized physical state. |
| `src/gates/misc/Joke_NeGate.js:27` | “Ne-Gate”, a pun, visible in Scalar. | “Scalar phase (π)” or “Amplitude negation”. Existing description “Negates all amplitudes” is accurate. |
| `src/gates/misc/Joke_MysteryGate.js:28–29` | “Mystery Gate”; “Different every time.” Import/serialization reachable; absent from the current palette groups. | “Random unitary”; “A sampled single-qubit unitary matrix.” Explain regeneration only in contexts that regenerate it. Do not claim a Haar-uniform distribution. |
| `src/gates/misc/Joke_ImaginaryGate.js:25,36,48,63` | “Imaginary Gate”, “Anti-Imaginary Gate”, “Half Imaginary Gate”, “Half Anti-Imaginary Gate”. Visible in Scalar. | Optional precision improvement: “Scalar phase (π/2)”, “Scalar phase (−π/2)”, “Scalar phase (π/4)”, “Scalar phase (−π/4)”. “Imaginary” is mathematically legitimate, not itself toy wording. |

Scalar palette membership is in `src/gates/AllGates.js:460–470`. Display-name changes should retain serialized gate IDs and supported imported circuits. A scalar phase can become relative when controlled; avoid descriptions claiming it is always physically irrelevant.

## 3. Apologetic and unclear disabled-state language

There are **14 occurrences** of `(sorry)` in gate-disabled messages. These are user-visible circuit annotations. Replace them with concise reasons, keeping the existing restrictions intact. The rendered gate annotations are small, so longer detail belongs in the associated description rather than unbounded text inside the gate.

| Current phrase | All source locations | Replacement direction |
| --- | --- | --- |
| `no / remix / (sorry)` | `src/circuit/model/GateColumn.js:203,209,230,335`; `src/gates/misc/SwapGateHalf.js:81,84` | “Unsupported after measurement”, with a precise explanation of the measured/coherent mixing restriction. It is an implementation limit, not a universal quantum prohibition. |
| `can't / nest / displays / (sorry)` | `src/gates/displays/amplitudes/AmplitudeDisplay.js:34`; `src/gates/displays/probability/ProbabilityDisplay.js:37`; `src/gates/displays/sample/SampleDisplay.js:47`; `src/gates/displays/density/DensityMatrixDisplay.js:33`; `src/gates/displays/bloch/BlochSphereDisplay.js:27` | “Nested display unsupported”. |
| `can't / nest / measure / (sorry)` and `can't / control / (sorry)` | `src/gates/probes/MeasurementGate.js:58,62` | “Nested measurement unsupported” and “Controlled measurement unsupported”. |
| `can't / nest / assertions / (sorry)` | `src/gates/assertions/AssertionGates.js:50` | “Nested assertion unsupported”. |

One additional disabled-state message says `hidden / measure / broken` in `src/engine/simulation/CircuitComputeUtil.js:54`. Prefer “Embedded measurement unsupported”; preserve the underlying nested-measurement restriction.

## 4. Optional vocabulary simplification

The recording vocabulary is coherent as a media metaphor, but less direct for scientific inspection. It is a subjective naming choice, not a confirmed defect. If changed, change the vocabulary together:

| Existing term | Clearer research-workflow term | Primary locations |
| --- | --- | --- |
| Tape | Recordings | `src/components/panels/panels.jsx:73`; `src/components/panels/tape/tape-body.jsx:47`; `doc/README.md:29` |
| take | snapshot | `src/components/panels/tape/tape-body.jsx:47,50,57,61,64`; `src/components/panels/tape/take-card.jsx`; `src/components/panels/tape/ready-controls.jsx`; `doc/README.md:28` |
| ghost | automatic snapshot | `src/components/panels/tape/tape-body.jsx:49`; `src/components/panels/tape/take-card.jsx:23`; recording/store internals |
| album | collection | `src/components/panels/tape/tape-body.jsx:47,51`; `src/results/files/json.js`; `src/results/README.md` |
| “Demo” image alt text | “Quirk-Bench circuit workspace” | `README.md:41`; image asset `doc/README_Demo.png` may retain its filename |

“Press REC” in `src/components/panels/tape/tape-body.jsx:64` should match the actual visible **Record** action even if the rest of the media metaphor is retained. “Keep eight ghosts before edits” is the least self-explanatory label in this group; “Keep the eight most recent pre-edit snapshots” states its behavior.

“Chance” can optionally become “Probability” in visible display captions, but it is already valid plain language and is not a toy signal. Preserve `Chance` serialized IDs (`src/gates/displays/probability/ProbabilityDisplay.js`).

## 5. Internal naming and exclusions

Four current source filenames explicitly label implemented operators as jokes:

- `src/gates/misc/Joke_ZeroGate.js` → `ZeroGate.js`
- `src/gates/misc/Joke_NeGate.js` → `AmplitudeNegationGate.js`
- `src/gates/misc/Joke_ImaginaryGate.js` → `ScalarPhaseGates.js`
- `src/gates/misc/Joke_MysteryGate.js` → `RandomUnitaryGate.js`

These are contributor-facing, not product labels. Renaming requires updating import consumers; it does not require changing public exports or serialized IDs.

Keep the following distinctions:

- **Quirk-Bench / upstream Quirk attribution:** the chosen product identity and required provenance are not toy claims.
- **Forge:** currently an internal module/panel ID. The visible labels are “Make gate” and “Make a gate”; there is no public “Forge” label to fix in the current registry/header.
- **Magic State Distillation, imaginary numbers, little-endian, quantum teleportation:** established scientific terms; do not sanitize them based on casual meanings.
- **Play, pause, steps, time, examples, Basic Actions, small circuits, 16-qubit limit, circuit-literate learners:** ordinary controls, useful documentation, or factual scope. They do not imply a toy.
- **Universal NOT / Impossible_UniversalNotGate.js / `__unstable__UniversalNot`:** convey genuine physical or compatibility boundaries. Preserve the impossibility warning and imported IDs. “Nonphysical universal NOT” could clarify a visible label, but should not conceal its status.
- **Shadow-Quant storage keys and file-format tags:** legacy compatibility identifiers, not current branding. Do not casually rename IndexedDB/localStorage keys or take/album schema versions.
- **Internal `Hack`/`Cheat` comments:** found in `src/engine/math/formula/FormulaParser.js:47`, `src/gates/arithmetic/ModularIncrementGates.js:57`, `test/TestRunner.js:68`, and `test/TestUtil.js:17`. These document implementation/testing compromises; clarify only with technical verification, not cosmetic deletion. The modular-arithmetic comment in particular explains a numerical workaround.
- **Test-only “Oops.”** in `test/diagnostics/errorReporter.test.js:83,89` is a synthetic fixture, not shipped copy.
- **Historical documents:** no literal `toy`, `toys`, `joke`, `jokes`, `playground`, `hobby`, or `amateur` whole-word matches were found in the scanned Markdown/JSON under `doc/plans`, `doc/reviews`, and `docs` before this report was written. Old project names there remain historical evidence.

## Recommended first edit batch

Change the explicit toy descriptions, README tone/limitation wording, JavaScript fallback, Zero/Ne gate names, and apologetic annotations first. Decide the recording vocabulary as one coherent follow-up; it is a larger user-facing terminology change. Do not replace modest descriptions with unsupported “research-grade”, “production-ready”, or “enterprise” claims.


## Complete affected-copy inventory for optional terminology changes

These are follow-through locations, not additional independent defects. They let a later edit replace terminology consistently across headings, accessible names, downloads, validation, and notifications.

### Recording language

| File | Lines and visible wording |
| --- | --- |
| `src/components/panels/panels.jsx` | 73: Tape |
| `src/components/panels/tape/tape-panel.jsx` | 7: Opening Tape… |
| `src/components/panels/tape/tape-body.jsx` | 47: Tape, takes, album; 49: ghosts; 50: Import takes; 51–52: Download album, tape.json, tape.csv; 57: Download deleted take; 61: Download unsaved takes, unsaved-takes.json; 64: No takes yet / Press REC |
| `src/components/panels/tape/take-card.jsx` | 23: Ghost; 33–35: Take JSON, Take CSV, Take link, and “Download this take…” fallbacks |
| `src/components/panels/tape/compare.jsx` | 15: Compare takes (accessible label) |
| `src/components/panels/tape/ready-controls.jsx` | 45: Record to the Tape; 49: one take, at the playhead; 55: a take per step, start to end |
| `src/components/toolbar/time-lane.jsx` | 20: take badge; 41: Held at the restored take's phase |
| `src/components/panels/export/export-panel-body.jsx` | 124–125: Download take JSON, take.json, take.csv |
| `src/app/state/Recorder.js` | 32: generated name `take ${n}`; 71: Whole-run recording cancelled; no takes were saved |
| `src/results/take/snapshot.js` | 45,66: default name take |
| `src/results/tapeStore.js` | 50,52: Tape storage; 111: take already gone / Refresh Tape; 125: take ID conflict; 181: unsaved takes; 208: deleted ghost / Tape storage; 209: Tape full / unsaved take / saved takes |
| `src/results/files/link.js` | 8: Take exceeds the 32 KiB link limit |
| `src/results/files/json.js` | 12,21,26,36,38: Take input / Invalid take JSON / Invalid album / Invalid take at index / Duplicate take identity |
| `src/results/take/validation.js` | 75,80,86: Invalid take / Invalid take step or wire count |
| `src/app/session/url.js` | 119–120: Take link exceeds 32 KiB / A take link must contain one take |
| `doc/README.md` | 28–29,34: take, Tape, restored take |
| `src/results/README.md` | Recording/retention documentation throughout; distinguish prose edits from preserved schema identifiers |

If this vocabulary changes, update user-visible text, accessible labels, tests of that text, and current documentation together. Internal object fields, exports, database names, format tags, and URL `take` parameters need not change.

### Probability language

“Chance” is valid plain language. These are optional consistency targets if the project prefers “probability” throughout:

| File | Lines and wording |
| --- | --- |
| `src/gates/displays/probability/ProbabilityDisplay.js` | 29: Chance symbol; 32: Shows chances of outcomes if a measurement was performed |
| `src/editor/rendering/outputs/CircuitAmplitudes.js` | 69: chance · phase |
| `src/editor/rendering/outputs/CircuitCaptions.js` | 60: Chance/Bloch; 108: bar = chance · ring = log chance; 163: post-selection explanation |
| `src/draw/displays/density/DensityMatrixView.js` | 49: diagonal shade = chance; 59: Diagonal bars: chance |
| `src/draw/displays/probability/SampleView.js` | 81: chance |
| `src/draw/displays/probability/ProbabilityView.js` | 99: bar length = chance; 196: Chance of being ON if measured |
| `src/draw/renderers/dataRenderers.js` | 240,448,449: Chance of a basis state |
| `src/components/panels/probabilities/probabilities-panel.jsx` | 263–266: chances and conditional product explanation |

Current “odds” matches in the reviewed register code are comments, not visible labels. Preserve `Chance` serialized IDs and existing examples that use them.

### Other low-priority clarity candidates

| Source | Current wording | Optional alternative |
| --- | --- | --- |
| `src/gates/AllGates.js:321` | Spinning (category of X/Y/Z time-dependent powers) | Time-dependent powers |
| `src/gates/misc/Joke_ImaginaryGate.js:26,37,49,64` | Phases everything by i / −i / √i / √−i | Multiplies all amplitudes by the stated factor |
| `src/components/panels/circuit/selection-bar.jsx:108` | Make a gate of it | Create gate from selection |
| `src/components/panels/panels.jsx:98`; `src/components/panels/forge/forge-panel-body.jsx:68` | Make gate / Make a gate | Create gate |
| `src/components/panels/export/export-panel-body.jsx:65` | without special characters that confuse forums | with an encoded circuit definition for sharing |

No joke terminology was confirmed in the current example menu titles. Alice/Bob, Referee, Win?, and Magic State Distillation have legitimate roles in the quantum protocols represented there. The selected Quirk-Bench brand is retained; this audit is not a request to reopen that naming decision.
