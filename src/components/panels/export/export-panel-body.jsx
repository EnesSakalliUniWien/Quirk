import { createTake } from "../../../results/take/snapshot.js";
import { takeJson } from "../../../results/files/json.js";
import { takeCsv } from "../../../results/files/csv.js";
import { downloadFile } from "../../../browser/downloadFile.js";
import { useMemo, useState } from "react";
import { AppInfo } from "../../../config/AppInfo.js";
import { useObservedValue } from "../../useObservedValue.js";
import { CopyButton } from "./copy-button.jsx";

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
  const [fullCircuit, setFullCircuit] = useState(false);

  const escapedUrlHash =
    "#" + AppInfo.URL_CIRCUIT_PARAM_KEY + "=" + encodeURIComponent(jsonText ?? "");
  const escapedLink = document.location.href.split("#")[0] + escapedUrlHash;

  const currentTake = () => {
    const result = deps.recorder.capture();
    return createTake(fullCircuit ? {...result, step: result.circuit.columns.length, stats: result.fullStats} : result);
  };
  const simulationJson = () => {
    const text = takeJson(currentTake());
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
                id="export-full-circuit"
                checked={fullCircuit}
                onChange={(event) => setFullCircuit(event.target.checked)}
              />{" "}
              Full circuit (default: playhead)
            </label>
            <button type="button" id="export-take-download" onClick={() => downloadFile(simulationJson(), "take.json")}>Download take JSON</button>
            <button type="button" onClick={() => downloadFile(takeCsv([currentTake()]), "take.csv", "text/csv")}>Download probabilities CSV</button>
            <CopyButton id="export-take-csv-copy" resultId="export-take-csv-result" label="Copy CSV" text={() => takeCsv([currentTake()])} />
            <pre id="export-amplitudes-pre" className="output-box">
              {amplitudes}
            </pre>
          </div>
        </section>
      </div>
    </>
  );
}

export { ExportPanelBody };
