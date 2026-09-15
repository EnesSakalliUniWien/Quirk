/**
 * @typedef {object} AnalyzerHeaderProps
 * @property {string} subtitle Whose state is shown, and from where.
 */

/**
 * The analyzer's title, and the line saying which state it is showing.
 *
 * @param {AnalyzerHeaderProps} props
 */
function AnalyzerHeader({ subtitle }) {
  return (
    <header className="panel-header">
      <h2 id="bloch-title" className="bloch-title">
        Bloch Sphere Analyzer
      </h2>
      <p id="bloch-subtitle" className="bloch-subtitle">
        {subtitle}
      </p>
    </header>
  );
}

export { AnalyzerHeader };
