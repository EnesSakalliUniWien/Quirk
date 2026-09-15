# Base code

General helpers with no dependency on the engine, circuit, drawing or browser layers.
Import functions from their owning file directly.

| File | Responsibility |
| --- | --- |
| `preconditions.js` | `need` input checks |
| `Equate.js` | Value equality, strict equality and `isEqualTo` comparisons |
| `Format.js` | Numeric formatting and parsing, binary labels and superscript digits |
| `maps.js` | Merge maps |

Equality and formatting keep their distinct existing behavior: `equate`, `STRICT_EQUALITY`
and `CUSTOM_IS_EQUAL_TO_EQUALITY` are different comparisons.

Bit counting, powers of two, modular arithmetic and trigonometry belong to
[`src/engine/math`](../engine/math/README.md). Tests mirror the owning directory under `test/`.
