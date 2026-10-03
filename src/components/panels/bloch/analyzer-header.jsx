/**
 * @typedef {object} AnalyzerHeaderProps
 * @property {string} subtitle Whose state is shown, and from where.
 * @property {import("react").Ref<HTMLHeadingElement>=} titleRef The title, which takes focus when
 *     the analyzer opens for a sphere.
 */

/**
 * The analyzer's title, and the line saying which state it is showing.
 *
 * @param {AnalyzerHeaderProps} props
 */
function AnalyzerHeader({ subtitle, titleRef }) {
  return (
    <header className="panel-header">
      <h2 id="bloch-title" className="bloch-title" ref={titleRef} tabIndex={-1}>
        Bloch sphere analyzer
      </h2>
      <p id="bloch-subtitle" className="bloch-subtitle">
        {subtitle}
      </p>
    </header>
  );
}

export { AnalyzerHeader };
