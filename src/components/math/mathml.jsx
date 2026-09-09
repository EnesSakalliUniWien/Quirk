/**
 * Numbers written as mathematics, using the browser's own MathML.
 *
 * The card used to print Unicode glyphs - `√½`, `Z^¼` - which read badly at small sizes: `√½` is
 * ambiguous between the root of a half and a half of a root. MathML stacks fractions, sizes
 * radicals over their content, and stretches brackets to the matrix they enclose, natively and at
 * no cost in bytes.
 *
 * Every entry is a real element, so a renderer above can hover, highlight or colour one cell.
 */

/** How close a value must be to a nice form before it is written as one. */
const TOLERANCE = 1e-6;
/** Denominators worth writing as a fraction rather than a decimal. */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 12, 16];
/** Roots worth writing as a radical: √2 and √3 cover the gates that exist. */
const ROOTS = [2, 3];

/**
 * A real number as MathML, preferring the exact form a reader recognises: an integer, a fraction,
 * or something over a root. Falls back to three decimals.
 *
 * @param {!number} value
 * @param {!string} keyPrefix
 * @returns {*} MathML elements.
 */
function realMath(value, keyPrefix = "r") {
  const sign = value < 0 ? <mo key={`${keyPrefix}-sign`}>−</mo> : undefined;
  const size = Math.abs(value);

  const body = (() => {
    if (Math.abs(size - Math.round(size)) < TOLERANCE) {
      return <mn key={`${keyPrefix}-n`}>{Math.round(size)}</mn>;
    }
    for (const denominator of DENOMINATORS) {
      const numerator = size * denominator;
      if (Math.abs(numerator - Math.round(numerator)) < TOLERANCE) {
        return (
          <mfrac key={`${keyPrefix}-f`}>
            <mn>{Math.round(numerator)}</mn>
            <mn>{denominator}</mn>
          </mfrac>
        );
      }
    }
    for (const root of ROOTS) {
      const numerator = size * Math.sqrt(root);
      if (Math.abs(numerator - Math.round(numerator)) < TOLERANCE) {
        // 0.707… is 1/√2, and reads far better written that way than as a decimal.
        return (
          <mfrac key={`${keyPrefix}-s`}>
            <mn>{Math.round(numerator)}</mn>
            <msqrt>
              <mn>{root}</mn>
            </msqrt>
          </mfrac>
        );
      }
    }
    return <mn key={`${keyPrefix}-d`}>{size.toFixed(3)}</mn>;
  })();

  return [sign, body].filter((e) => e !== undefined);
}

/**
 * A complex number as MathML: 0, 1, -1, i, ½, 1/√2, or a sum of a real and an imaginary part.
 *
 * @param {!Complex} value
 * @param {!string} keyPrefix
 * @returns {*} MathML elements.
 */
function complexMath(value, keyPrefix = "c") {
  const { real, imag } = value;
  const hasReal = Math.abs(real) > TOLERANCE;
  const hasImag = Math.abs(imag) > TOLERANCE;

  if (!hasReal && !hasImag) {
    return <mn key={`${keyPrefix}-0`}>0</mn>;
  }

  const imaginary = () => {
    const unit = <mi key={`${keyPrefix}-i`}>i</mi>;
    // 1i and -1i are written i and -i, the way anyone writing them by hand would.
    return Math.abs(Math.abs(imag) - 1) < TOLERANCE
      ? [unit]
      : [...realMath(Math.abs(imag), `${keyPrefix}-im`), unit];
  };

  if (!hasReal) {
    return (
      <>
        {imag < 0 ? <mo key={`${keyPrefix}-neg`}>−</mo> : undefined}
        {imaginary()}
      </>
    );
  }
  if (!hasImag) {
    return <>{realMath(real, `${keyPrefix}-re`)}</>;
  }
  return (
    <>
      {realMath(real, `${keyPrefix}-re`)}
      <mo key={`${keyPrefix}-op`}>{imag < 0 ? "−" : "+"}</mo>
      {imaginary()}
    </>
  );
}

/**
 * A matrix as mathematics: entries written out, inside brackets that stretch to the table.
 *
 * @param {!{model: !MatrixModel, label: (undefined|!string)}} props
 */
function MatrixMath({ model, label = "The gate's matrix" }) {
  return (
    <math className="matrix-math" display="block" aria-label={label}>
      <mrow>
        <mo stretchy="true">[</mo>
        <mtable>
          {Array.from({ length: model.rows }, (_, row) => (
            <mtr key={row}>
              {Array.from({ length: model.cols }, (_, col) => (
                <mtd key={col}>
                  <mrow>{complexMath(model.at(row, col), `${row}-${col}`)}</mrow>
                </mtd>
              ))}
            </mtr>
          ))}
        </mtable>
        <mo stretchy="true">]</mo>
      </mrow>
    </math>
  );
}

export { MatrixMath };
