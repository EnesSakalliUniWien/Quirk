import { useEffect, useRef, useState } from "react";
import { useDebounced, PREVIEW_DEBOUNCE_MILLIS } from "./useDebounced.js";
import { OperationPreview } from "./operation-preview.jsx";

/**
 * One matrix-based forge method: parse the inputs into an operation, preview it beside its Bloch
 * rotation, and on confirmation wrap it in a gate and commit it. The rotation and matrix sections
 * are both this skeleton; only their inputs, parsing, and gate dressing differ.
 *
 * @param {!{heading: !string, canvasId: !string, buttonId: !string, buttonLabel: !string,
 *     nameId: !string, namePlaceholder: !string, inputs: !string, parseOp: !function(): !Matrix,
 *     buildGate: !function(!Matrix, !string): !Gate, onCreate: !function(!Gate): void,
 *     children: *}} props
 */
function MatrixMethod({
  heading,
  canvasId,
  buttonId,
  buttonLabel,
  nameId,
  namePlaceholder,
  inputs,
  parseOp,
  buildGate,
  onCreate,
  children,
}) {
  const [preview, setPreview] = useState({});
  // Held in a ref so the paint effect can call the latest parser without depending on its identity.
  const parseOpRef = useRef(parseOp);
  parseOpRef.current = parseOp;
  const [name, setName] = useState("");
  const [buildable, setBuildable] = useState(false);
  const settled = useDebounced(inputs, PREVIEW_DEBOUNCE_MILLIS);

  // Repaints when the settled inputs change. parseOp closes over those inputs, so `settled` is
  // what makes it current; depending on parseOp itself would repaint on every render.
  useEffect(() => {
    try {
      const matrix = parseOpRef.current();
      setPreview({matrix});
      setBuildable(!matrix.hasNaN());
    } catch (error) {
      setPreview({error: String(error)});
      setBuildable(false);
    }
  }, [settled]);

  const create = () => {
    let matrix;
    try {
      matrix = parseOp();
    } catch (ex) {
      console.warn(ex);
      return; // The button is about to be disabled, so no handling required.
    }
    onCreate(buildGate(matrix, name));
  };

  return (
    <section className="forge-method">
      <h2>{heading}</h2>
      <div className="forge-fields">{children}</div>
      <div id={canvasId}>
        {preview.matrix ? <OperationPreview matrix={preview.matrix} /> : <p role="alert">{preview.error}</p>}
      </div>
      <label className="forge-field" htmlFor={nameId}>
        <span>Circuit symbol</span>
        <input
          id={nameId}
          type="text"
          placeholder={namePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button id={buttonId} type="button" disabled={!buildable} onClick={create}>
        {buttonLabel}
      </button>
    </section>
  );
}

export { MatrixMethod };
