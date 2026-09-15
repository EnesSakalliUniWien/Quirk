# Math code

Pure numeric code with no dependency on the circuit, editor or drawing layers. Scalar functions
depend only on `src/base/`; complex, formula and matrix code build on these functions in that order.
Class modules hold exactly one class; function modules group related calculations.
Import the owning file directly.

```text
math/
├── bitOperations.js            counting set bits
├── powersOfTwo.js              binary sizes, integer logarithms and powers of two
├── modularArithmetic.js        positive remainders, extended GCD and modular inverses
├── trigonometry.js             cosine and sine snapped at multiples of pi/4
├── complex/
│   └── Complex.js               the complex number value type
├── preparedStates.js            the states a prepare box puts its wires in, and its rank-one matrix
├── bloch.js                     Bloch coordinates, angles, quaternions and readout text of one qubit
├── formula/
│   ├── FormulaParser.js         the tokenizer and infix parser shared by every formula
│   ├── ComplexFormula.js        ComplexFormula.parse and its token maps, with an explicit angle unit
│   ├── AngleExpression.js       AngleUnit and parseAngleExpression for constant angles
│   └── Axis.js                  user-entered rotation axes like "X+2*Y-Z"
└── matrix/
    ├── Matrix.js                storage, construction, equality, arithmetic, predicates, text I/O
    ├── MatrixDecomposition.js   QR, LQ and singular value decompositions, and closestUnitary
    ├── QubitMatrix.js           Pauli and Hadamard matrices, rotation and Bloch vector conversions
    └── ReadableJson.js          static vector encodings for the JSON export
```

## complex

`Complex` is an immutable value type. Formula and matrix code build on it; scalar functions
have no dependency on it.

## formula

`FormulaParser.parse` turns text into a value given a token map. `ComplexFormula` builds the complex
token maps: `ComplexFormula.parse(text, {angleUnit, variables})` defaults to `ComplexFormula.DEGREES`,
which is the convention of serialized matrices and `Matrix.parse`. Formula gates pass
`ComplexFormula.RADIANS` and a `t` variable. `Axis` keeps its own token map.
`parseAngleExpression` evaluates a constant angle in one `AngleUnit`, the formula language's own
angle units, for the angle fields and the rotation gates' parameter dialogs.

## matrix

`Matrix` is the value type. `MatrixDecomposition` holds static factorizations that take a matrix, and
`QubitMatrix` is a static namespace for single-qubit constants and conversions. Operations that
only the tests need, such as tensor products, eigendecomposition and the CPU register expansion,
live in `test/MatrixTestUtil.js`.

## Tests

`test/engine/math/` mirrors this directory. The 2D `Point` and `Rect` types live in `src/geometry/`,
and the GPU backend and circuit simulation that build on this code live beside it in `src/engine/`.
