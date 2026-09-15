/**
 * @typedef {object} AnalyzerFooterProps
 * @property {() => void} onClose
 */

/**
 * The analyzer's action row: closing it.
 *
 * @param {AnalyzerFooterProps} props
 */
function AnalyzerFooter({ onClose }) {
  return (
    <div className="panel-action-row bloch-actions">
      <button id="bloch-close-button" type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

export { AnalyzerFooter };
