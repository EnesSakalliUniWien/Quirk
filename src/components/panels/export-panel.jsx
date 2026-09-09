import { useMemo, useState } from "react";
import { useStore } from "zustand";

import { AppInfo } from "../../config/AppInfo.js";
import { appStore } from "../../state/appStore.js";
import { useObservedValue } from "../useObservedValue.js";

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
      setResult("It didn't work...");
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

/**
 * @param {!string} jsonText
 * @returns {!string} The circuit's JSON, indented, or the raw text when it will not parse.
 */
function prettyCircuitJson(jsonText) {
  try {
    return JSON.stringify(JSON.parse(jsonText), null, "  ");
  } catch {
    return jsonText;
  }
}

/**
 * The export panel: the circuit as a shareable link, as JSON, and the simulation's output data.
 */
function ExportPanel() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  // The body is split out because it observes the revision, and a hook cannot be skipped while
  // the circuit is still starting up.
  return deps === undefined ? (
    null
  ) : (
    <ExportPanelBody deps={deps} />
  );
}

/**
 * @param {!{deps: !Object}} props
 */
function ExportPanelBody({ deps }) {
  // Memoized: latestActiveCommit() builds a fresh observable per call, and an unmemoized one would
  // resubscribe on every render.
  const commits = useMemo(() => deps.revision.latestActiveCommit(), [deps]);
  const jsonText = useObservedValue(commits);
  // Generated on demand: the amplitudes are large, and re-deriving them every frame would cost
  // more than the panel is worth.
  const [amplitudes, setAmplitudes] = useState("[not generated yet]");
  const [skipAmplitudes, setSkipAmplitudes] = useState(false);

  const escapedUrlHash =
    "#" + AppInfo.URL_CIRCUIT_PARAM_KEY + "=" + encodeURIComponent(jsonText ?? "");
  const escapedLink = document.location.href.split("#")[0] + escapedUrlHash;

  const simulationJson = () => {
    const raw = JSON.stringify(
      deps.mostRecentStats.get().toReadableJson(!skipAmplitudes),
      null,
      " ",
    );
    const text = raw
      .replace(/{\s*"r": /g, '{"r":')
      .replace(/,\s*"i":\s*([-e\d.]+)\s*}/g, ',"i":$1}');
    setAmplitudes(text);
    return text;
  };

  return (
    <>
      <div className="panel-body panel-stack" aria-labelledby="export-title">
        <header className="panel-header">
          <p className="panel-eyebrow">Share and inspect</p>
          <h1 id="export-title" className="panel-title">
            Export circuit
          </h1>
          <p className="panel-description">
            Copy a link, the circuit JSON, or the simulation data.
          </p>
        </header>

        <section className="panel-section">
          <div className="panel-section-heading">
            <strong className="panel-section-title">Escaped Link</strong> — Link to the
            current circuit without special characters that confuse forums.
          </div>
          <div className="panel-section-body">
            <CopyButton
              id="export-link-copy-button"
              resultId="export-link-copy-result"
              label="Copy to Clipboard"
              text={() => escapedLink}
            />
            <div className="output-box">
              <a id="export-escaped-anchor" href={escapedUrlHash}>
                {escapedLink}
              </a>
            </div>
          </div>
        </section>

        <section className="panel-section">
          <div className="panel-section-heading">
            <strong className="panel-section-title">Circuit JSON</strong> — Parsable
            representation of the current circuit.
          </div>
          <div className="panel-section-body">
            <CopyButton
              id="export-json-copy-button"
              resultId="export-json-copy-result"
              label="Copy to Clipboard"
              text={() => prettyCircuitJson(jsonText ?? "")}
            />
            <pre id="export-circuit-json-pre" className="output-box">
              {prettyCircuitJson(jsonText ?? "")}
            </pre>
          </div>
        </section>

        <section className="panel-section">
          <div className="panel-section-heading">
            <strong className="panel-section-title">Simulation Data JSON</strong> — Output
            amplitudes, detector results, display data, and related values.
          </div>
          <div className="panel-section-body">
            <CopyButton
              id="export-amplitudes-button"
              resultId="export-amplitudes-result"
              label="Generate and Copy to Clipboard"
              text={simulationJson}
            />
            <label className="checkbox-row">
              <input
                type="checkbox"
                id="export-amplitudes-use-amps"
                checked={skipAmplitudes}
                onChange={(event) => setSkipAmplitudes(event.target.checked)}
              />{" "}
              Skip output amplitudes
            </label>
            <pre id="export-amplitudes-pre" className="output-box">
              {amplitudes}
            </pre>
          </div>
        </section>
      </div>
    </>
  );
}

export { ExportPanel };
