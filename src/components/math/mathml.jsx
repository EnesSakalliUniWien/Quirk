import { numberForm, TOLERANCE } from "./numberForm.js";

/**
 * Numbers written as mathematics, using the browser's own MathML.
 *
 * The card used to print Unicode glyphs - `√½`, `Z^¼` - which read badly at small sizes: `√½` is
 * ambiguous between the root of a half and a half of a root. MathML stacks fractions, sizes
 * radicals over their content, and stretches brackets to the matrix they enclose, natively and at
 * no cost in bytes.
 *
 * Which form a number takes is decided in src/components/math/numberForm.js; this file only draws
 * it. Every entry is a real element, so a renderer above can hover, highlight or colour one cell.
 */

/**
 * @param {!NumberForm} form
 * @param {!string} keyPrefix
 * @returns {*} One MathML element.
 */
function formMath(form, keyPrefix) {
  switch (form.kind) {
    case "integer":
      return <mn key={`${keyPrefix}-n`}>{form.value}</mn>;
    case "fraction":
      return (
        <mfrac key={`${keyPrefix}-f`}>
          <mn>{form.numerator}</mn>
          <mn>{form.denominator}</mn>
        </mfrac>
      );
    case "overRoot":
      // 0.707… is 1/√2, and reads far better written that way than as a decimal.
      return (
        <mfrac key={`${keyPrefix}-s`}>
          <mn>{form.numerator}</mn>
          <msqrt>
            <mn>{form.root}</mn>
          </msqrt>
        </mfrac>
      );
    case "trig":
      // cos(π/8) rather than 0.924: a rotation's entries are trig functions of its angle.
      return (
        <mrow key={`${keyPrefix}-t`}>
          <mi>{form.fn}</mi>
          <mo>&#x2061;</mo>
          <mo>(</mo>
          <mfrac>
            {form.numerator === 1 ? (
              <mi>π</mi>
            ) : (
              <mrow>
                <mn>{form.numerator}</mn>
                <mi>π</mi>
              </mrow>
            )}
            <mn>{form.denominator}</mn>
          </mfrac>
          <mo>)</mo>
        </mrow>
      );
    default:
      return <mn key={`${keyPrefix}-d`}>{form.value.toFixed(3)}</mn>;
  }
}

/**
 * A real number as MathML, in the most recognisable exact form it has.
 *
 * @param {!number} value
 * @param {!string} keyPrefix
 * @param {!("cos"|"sin")=} prefer Which trig function to name when the value is both.
 * @returns {*} MathML elements.
 */
function realMath(value, keyPrefix = "r", prefer = "cos") {
  const sign = value < 0 ? <mo key={`${keyPrefix}-sign`}>−</mo> : undefined;
  const body = formMath(numberForm(Math.abs(value), prefer), keyPrefix);
  return [sign, body].filter((e) => e !== undefined);
}

/**
 * A complex number as MathML: 0, 1, -1, i, ½, 1/√2, cos(π/8) - i sin(π/8), or another sum of a
 * real and an imaginary part.
 *
 * An imaginary part is always read as a sine and the real part as the caller says, so e^{iπ/8}
 * comes out as cos(π/8) + i sin(π/8), the way it would be written by hand.
 *
 * @param {!Complex} value
 * @param {!string} keyPrefix
 * @param {!("cos"|"sin")=} realPrefer
 * @returns {*} MathML elements.
 */
function complexMath(value, keyPrefix = "c", realPrefer = "cos") {
  const { real, imag } = value;
  if (!Number.isFinite(real) || !Number.isFinite(imag)) return <mtext>unavailable</mtext>;
  const hasReal = Math.abs(real) > TOLERANCE;
  const hasImag = Math.abs(imag) > TOLERANCE;

  if (!hasReal && !hasImag) {
    return <mn key={`${keyPrefix}-0`}>0</mn>;
  }

  const imaginary = () => {
    const unit = <mi key={`${keyPrefix}-i`}>i</mi>;
    // 1i and -1i are written i and -i, the way anyone writing them by hand would.
    if (Math.abs(Math.abs(imag) - 1) < TOLERANCE) {
      return [unit];
    }
    const size = realMath(Math.abs(imag), `${keyPrefix}-im`, "sin");
    // i sin(θ), not sin(θ) i: the unit goes in front of a function, behind a number.
    return numberForm(Math.abs(imag), "sin").kind === "trig"
      ? [unit, <mo key={`${keyPrefix}-times`}>&#x2062;</mo>, ...size]
      : [...size, unit];
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
    return <>{realMath(real, `${keyPrefix}-re`, realPrefer)}</>;
  }
  return (
    <>
      {realMath(real, `${keyPrefix}-re`, realPrefer)}
      <mo key={`${keyPrefix}-op`}>{imag < 0 ? "−" : "+"}</mo>
      {imaginary()}
    </>
  );
}

/**
 * Whether a cell's real part reads better as a cosine or a sine. A rotation keeps cosines on its
 * diagonal and sines off it; a state rotated away from |0⟩ keeps the cosine in its first entry.
 *
 * @param {!MatrixModel} model
 * @param {!int} row
 * @param {!int} col
 * @returns {!("cos"|"sin")}
 */
function preferenceAt(model, row, col) {
  if (model.cols === 1) {
    return row === 0 ? "cos" : "sin";
  }
  return row === col ? "cos" : "sin";
}

/**
 * A matrix's entries inside brackets that stretch to the table, as a MathML row. It belongs inside
 * a <math>: MatrixMath gives it one, and an equation can hold several complete factors side by side.
 *
 * @param {!{model: !MatrixModel, highlight: (undefined|!function(!int, !int): !boolean)}} props
 *     highlight marks cells a reader should look at - the entries a step changed, say.
 */
function MatrixRow({ model, highlight }) {
  return (
    <mrow data-matrix-kind={model.kind}>
      <mo stretchy="true">[</mo>
      <mtable className="matrix-table" style={{"--matrix-row-height": model.layout?.rowHeight === undefined ? undefined : `${model.layout.rowHeight}px`}}>
        {Array.from({ length: model.rows }, (_, row) => (
          <mtr key={row} data-matrix-row={row}>
            {Array.from({ length: model.cols }, (_, col) => (
              <mtd
                key={col}
                title={model.cols === 1 ? model.rowLabel(row) : `${model.rowLabel(row)} ← ${model.colLabel(col)}`}
                data-changed={highlight !== undefined && highlight(row, col) ? "" : undefined}
              >
                <mrow className="matrix-entry-value">
                  {complexMath(model.at(row, col), `${row}-${col}`, preferenceAt(model, row, col))}
                </mrow>
              </mtd>
            ))}
          </mtr>
        ))}
      </mtable>
      <mo stretchy="true">]</mo>
    </mrow>
  );
}

/**
 * A matrix as mathematics: entries written out, inside brackets that stretch to the table.
 *
 * @param {!{model: !MatrixModel, label: (undefined|!string)}} props
 */
function MatrixMath({ model, label = "The gate's matrix", highlight }) {
  return (
    <math className="matrix-math" display="block" aria-label={label}>
      <MatrixRow model={model} highlight={highlight} />
    </math>
  );
}

export { MatrixMath };
