/**
 * @typedef {object} ControlRowProps
 * @property {string} label The row's name, printed small at its start.
 * @property {import("react").ReactNode} children The row's controls.
 * @property {string=} role
 * @property {string=} ariaLabel Names the row for assistive technology, when it is a group.
 */

/**
 * One labelled row of the analyzer's controls: a short name, then the controls it names.
 *
 * @param {ControlRowProps} props
 */
function ControlRow({ label, children, role, ariaLabel }) {
  return (
    <div className="bloch-control-row" role={role} aria-label={ariaLabel}>
      <span className="bloch-control-label">{label}</span>
      {children}
    </div>
  );
}

export { ControlRow };
