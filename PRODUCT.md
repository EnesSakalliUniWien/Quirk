# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are circuit-literate learners and researchers exploring and debugging small quantum circuits. This priority was confirmed by the user on 5 October 2026. The interface may explain its controls and visual encodings without becoming an introductory quantum-computing course.

## Product Purpose

Quirk-Bench, developed in the Quirk repository, lets people construct small quantum circuits and inspect their behavior interactively. Success means users can connect a circuit operation to its mathematical and visual consequences, adjust it precisely, and preserve or share useful circuits and recorded results.

## Operating Context

The existing application runs in a browser. People edit gates on a circuit workspace, use separate Steps and Time controls, inspect state/probability/Bloch/algebra views, construct or parameterize gates, and record, compare, import, or export recorded results. The workspace supports keyboard, pointer, and touch interaction and adapts its docked panels to available space.

## Capabilities and Constraints

- Preserve scientific meanings: phase, magnitude, probability, state amplitudes, and measurement-aware readouts are distinct quantities.
- Preserve independent Steps and Time behavior, exact parameter expressions, and negative or multiple-turn angles. Accessibility or visual changes must not silently alter the scientific model.
- The incumbent implementation uses React, Vite, PixiJS, Dockview, Base UI, and shared appearance data. Reuse existing capabilities before adding dependencies or infrastructure.
- Retain user circuit work, drafts, and recorded results through supported interactions; surface recoverable errors with actionable feedback.
- The user selected verified fixes first, followed by targeted polish. A broader workflow or visual redesign is outside this refinement's scope.

## Evidence on Hand

- `README.md` and `doc/README.md`: existing product description and interaction manual.
- `src/components`, `src/app`, `src/appearance`, and `src/styles`: incumbent interface and implementation authority.
- `doc/reviews/2026-10-05-apple-hig/README.md`: current HIG audit with a 172-page applicability matrix, source references, browser reproductions, and explicit verification limits.
- `test` and `test_e2e`: existing behavior and integration checks. Recorded test results establish only the code and environment that were tested.

## Product Principles

- Make scientific behavior precise and inspectable.
- Keep common editing and inspection tasks direct, with advanced detail available in context.
- Support meaningful keyboard, pointer, touch, and assistive-technology access.
- Make errors understandable and destructive actions recoverable where practical.
- Prefer small improvements to existing workflows over speculative systems or unrelated platform integrations.

## Accessibility & Inclusion

Current priorities include truthful numeric control semantics, composition-safe text input, perceivable feedback, readable interface text, and usable scientific readouts. HIG principles inform the browser interface; native Apple features and APIs are not automatically product requirements. Chromium accessibility-tree or synthetic input evidence must not be represented as a real Safari/VoiceOver or physical-device test.

## Open Product Decisions

A localization roadmap, additional native platforms, and broader beginner onboarding have not been selected. They are not prerequisites for the current refinement.
