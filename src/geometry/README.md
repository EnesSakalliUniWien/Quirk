# Geometry code

The 2D `Point` and `Rect` value types the editor, painters and dialogs lay out with. `index.js`
re-exports both as the geometry namespace. Nothing here depends on `src/engine/`, and nothing in
`src/engine/` depends on this directory.

`Rect.isApproximatelyEqualTo` has no production callers but stays because the test assertions
dispatch to it. `test/geometry/` holds the unit tests.
