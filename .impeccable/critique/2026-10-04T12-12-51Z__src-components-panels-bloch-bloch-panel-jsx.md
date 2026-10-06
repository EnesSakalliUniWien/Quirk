---
target: Bloch sphere visualization
total_score: 30
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 0
target_identity: "file:/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/bloch/bloch-panel.jsx"
target_fingerprint: "sha256:963a2126399a20dedac88e862e862fe9778f3d5c78dfc109194c35b4653327de"
target_path: /Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk/src/components/panels/bloch/bloch-panel.jsx
timestamp: 2026-10-04T12-12-51Z
slug: src-components-panels-bloch-bloch-panel-jsx
closed: true
---
Method: dual-agent (A: /root/bloch_visual_design · B: /root/bloch_visual_evidence), with parent inspection of the running visualization.

# Bloch sphere visualization review

Reviewed the actual production panel, not an all-layer drawing fixture. Evidence includes the H → T → X¼ → Bloch state, keyboard-rotated view, |0⟩, maximally mixed state, desktop 1280×720 and narrow 390×844. No visualization code changed during this review.

The visualization has a coherent scientific vocabulary and useful linked projections. Its main weakness is visual priority: the sphere is small and partly below the initial fold, while controls and advanced readouts get substantial space.

## Priority issues

1. **P2 — The sphere opens partly below the fold.** At 1280×720 the figures start near y=575 and extend to y=822. Seeing the complete sphere requires scrolling the angle controls away. Compact the source controls or move the main sphere higher, preserving simultaneous control-and-figure visibility. Source: src/styles/panels/bloch.css:71 and src/components/panels/bloch/bloch-panel.jsx:154. Suggested action: /impeccable layout.
2. **P2 — Equal figure widths underserve the 3D sphere.** Approximately 246px is shared equally by the sphere and each 2D projection. Six pole labels, axis letters, circles, component triangles, the state arrow and angle arcs compete in that small area. Enabling cos·sin adds tightly packed formula labels whose fixed placement does not coordinate with other labels. Give the sphere more space or a direct enlargement option; keep optional construction layers available. Source: src/styles/panels/bloch.css:110; src/draw/displays/bloch/BlochScene.js:257 and :385. This is a readability/design issue, not evidence of incorrect geometry. Suggested actions: /impeccable layout and /impeccable typeset.
3. **P2 — A complex amplitude splits inside its notation.** The observed β value displays +0.408+0.289 with i alone on the next line. The 6rem value column and overflow-wrap:anywhere permit this. Preserve the complex expression as an atomic value and allow its row enough width. Source: src/styles/panels/bloch.css:485 and :510; src/components/panels/bloch/readout-sidebar.jsx:106. Suggested action: /impeccable typeset.
4. **P2 — Accessible figure descriptions misstate camera and undefined direction.** The description always says seen from above after view rotation, and describes an arrow at θ —, ϕ — for the maximally mixed state. Remove fixed camera wording and describe no direction explicitly when |r|=0. Source: src/components/panels/bloch/bloch-figures.jsx:27–37. Suggested action: /impeccable clarify.

## What works

- The sample direction x=0.707, y=0.500, z=0.500 agrees with θ=60°, ϕ=35.3°, |r|=1. The meridian and equator provide readable companion views. This is inspected example evidence, not an exhaustive mathematical verification.
- Axis colours, letters and ket labels form a coherent vocabulary across the sphere, projections and readout. Front/solid and back/dashed segments help depth perception.
- Mixed and pole states explain undefined angles and disable the relevant controls. Keyboard rotation, Home reset and Back to circuit support reversible exploration.

## Design health (judgment, not an automated metric)

| Heuristic | Score /4 | Evidence |
|---|---:|---|
| System status | 4 | Explicit state, source and undefined quantities |
| Domain match | 4 | Linked sphere and angular projections |
| Control and freedom | 4 | Reset view, source restoration, exploration |
| Consistency | 3 | Coherent axis vocabulary; broken numeric wrapping |
| Error prevention | 4 | Undefined-angle controls disabled |
| Recognition over recall | 3 | Clear labels; layer meanings need learning |
| Flexibility | 3 | Keyboard rotation, numeric controls, steps |
| Minimalism | 2 | Dense annotations and advanced content always visible |
| Error recovery | n/a | Error state not exercised |
| Help | 3 | Useful contextual physical rules |
| **Total** | **30/36** | **Good foundation; targeted visual fixes needed** |

The default panel enables Components, Angles and Unit circles; it does not enable every construction. Seven presets and eight layer switches increase scanning effort but are grouped and optional. The expert loses simultaneous slider/figure visibility when scrolling; a newcomer meets quaternion content before the full sphere; a low-vision user faces small in-plot annotations. The exploration ends well when exceptional states are explained instead of presented as failures.

Minor observation: quaternion readout is always visible although quaternion drawing starts disabled. Progressive disclosure could free space, but this is a design preference, not an implementation defect.

## Evidence limits

The markup detector returned zero findings for src/components/panels/bloch. It cannot inspect the pixels drawn inside canvases. Browser overlay injection was unavailable because evaluation is read-only; no reliable detector overlay was created. No full screen-reader session or touch-device interaction audit was performed. Narrow viewport testing alone does not establish touch correctness.

Questions for a subsequent correction pass: prioritize a larger sphere with smaller companion projections, or retain equal plot sizes and simplify the initial overlays? Scope the next pass to definite formatting/accessibility defects, or include figure layout and hierarchy?
