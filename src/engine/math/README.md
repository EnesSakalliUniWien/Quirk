# Math code

Pure numeric code with no dependency on the circuit, editor or drawing layers. The three
sub-namespaces layer strictly, each depending only on the ones listed before it and on `src/base/`.
Every module holds exactly one class. Every directory has an `index.js` that re-exports its classes as the namespace; import the
owning file directly for a single symbol.

```text
math/
├── index.js                     the math namespace: re-exports the three below
├── complex/
│   ├── index.js
│   └── Complex.js               the complex number value type
├── formula/
│   ├── index.js
│   ├── FormulaParser.js         the tokenizer and infix parser shared by every formula
│   ├── ComplexFormula.js        ComplexFormula.parse and its token maps, with an explicit angle unit
│   └── Axis.js                  user-entered rotation axes like "X+2*Y-Z"
└── matrix/
    ├── index.js
    ├── Matrix.js                storage, construction, equality, arithmetic, predicates, text I/O
    ├── MatrixDecomposition.js   QR, LQ and singular value decompositions, and closestUnitary
    ├── QubitMatrix.js           Pauli and Hadamard matrices, rotation and Bloch vector conversions
    └── ReadableJson.js          static vector encodings for the JSON export
```

## complex

`Complex` is an immutable value type. Everything else in `src/engine/math/` builds on it.

## formula

`FormulaParser.parse` turns text into a value given a token map. `ComplexFormula` builds the complex
token maps: `ComplexFormula.parse(text, {angleUnit, variables})` defaults to `ComplexFormula.DEGREES`,
which is the convention of serialized matrices and `Matrix.parse`. Formula gates pass
`ComplexFormula.RADIANS` and a `t` variable. `Axis` keeps its own token map.

## matrix

`Matrix` is the value type. `MatrixDecomposition` holds static factorizations that take a matrix, and
`QubitMatrix` is a static namespace for single-qubit constants and conversions. Operations that
only the tests need, such as tensor products, eigendecomposition and the CPU register expansion,
live in `test/MatrixTestUtil.js`.

## Tests

`test/engine/math/` mirrors this directory. The 2D `Point` and `Rect` types live in `src/geometry/`,
and the GPU backend and circuit simulation that build on this code live beside it in `src/engine/`.
