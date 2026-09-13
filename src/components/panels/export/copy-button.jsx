import { useState } from "react";

/** How long a copy button reports what happened before going back to its label. */
const COPY_RESULT_MILLIS = 1000;

/**
 * A copy button and the line of text it reports into. The button is disabled while the result is
 * showing, so a rapid second press cannot overlap the first one's reset.
 *
 * @param {!{id: !string, resultId: !string, label: !string, text: !function(): !string}} props
 */
function CopyButton({ id, resultId, label, text }) {
  const [result, setResult] = useState("");

  const copy = async () => {
    setResult("…");
    try {
      await navigator.clipboard.writeText(text());
      setResult("Done!");
    } catch (ex) {
      setResult("It didn’t work…");
      console.warn("Clipboard copy failed.", ex);
    }
    setTimeout(() => setResult(""), COPY_RESULT_MILLIS);
  };

  return (
    <div className="panel-action-row">
      <button id={id} type="button" disabled={result !== ""} onClick={copy}>
        {label}
      </button>
      <span id={resultId} className="copy-result">
        {result}
      </span>
    </div>
  );
}

export { CopyButton };
