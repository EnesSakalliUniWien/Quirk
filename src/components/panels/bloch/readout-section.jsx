/**
 * @typedef {object} ReadoutSectionProps
 * @property {string} title
 * @property {import("react").ReactNode} children The section's rows and notes.
 */

/**
 * One titled section of the readout, ruled off from the next.
 *
 * @param {ReadoutSectionProps} props
 */
function ReadoutSection({ title, children }) {
  return (
    <section className="bloch-readout-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

export { ReadoutSection };
