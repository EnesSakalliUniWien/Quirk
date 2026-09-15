import { UNDEFINED_TEXT } from "../../../engine/math/bloch.js";

/**
 * @typedef {object} ReadoutRowProps
 * @property {string} symbol
 * @property {string=} symbolClass Colours the symbol, as for an axis.
 * @property {string=} formula What the value comes from, when that exists.
 * @property {string} value
 * @property {string=} id The value's id.
 * @property {string=} title Shown on hover: a value's full precision, say.
 * @property {boolean=} withFormula False for a row that has no formula column at all.
 */

/**
 * One line of the readout: its symbol, the formula it comes from, and its value right-aligned,
 * where a "—" reads in the muted colour so it never passes for a zero.
 *
 * @param {ReadoutRowProps} props
 */
function ReadoutRow({
  symbol,
  symbolClass,
  formula,
  value,
  id,
  title,
  withFormula = true,
}) {
  return (
    <div className="bloch-row">
      <dt className={symbolClass}>{symbol}</dt>
      {withFormula && (
        <dd className="bloch-formula">
          {formula === undefined ? "" : <code>{formula}</code>}
        </dd>
      )}
      <dd
        id={id}
        className={
          value === UNDEFINED_TEXT
            ? "bloch-value bloch-undefined"
            : "bloch-value"
        }
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}

export { ReadoutRow };
