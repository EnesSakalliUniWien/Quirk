import { useColourScheme } from "../../useColourScheme.js";
import { useMemo, useState } from "react";
import { distributions } from "../../../results/take/distributions.js";
import { takeJson } from "../../../results/files/json.js";
import { takeCsv } from "../../../results/files/csv.js";
import { takeLink } from "../../../results/files/link.js";
import { downloadFile } from "../../../browser/downloadFile.js";
import { Theme } from "../../../config/Theme.js";
import { CopyButton } from "../export/copy-button.jsx";
import { Distribution } from "./distribution.jsx";

/** The most frequent measured outcomes, as their bits, highest bit first. */
function measuredSummary(take, jointCounts) {
  if (jointCounts === undefined) return undefined;
  const { shots } = take.measurement;
  const top = jointCounts
    .flatMap((count, index) => (count > 0 ? [[index, count]] : []))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (top.length === 0) return `Measured ${shots} shots: unavailable`;
  return `Measured ${shots} shots: ${top.map(([index, count]) => `${index.toString(2).padStart(take.wires, "0")} ×${count}`).join(", ")}`;
}

function TakeCard({ record, selected, onSelect, recorder, act, onDelete }) {
  useColourScheme();
  const { take, ghost, linked = false } = record;
  const values = useMemo(() => distributions(take), [take]);
  const [name, setName] = useState(take.name);
  const [notes, setNotes] = useState(take.notes);
  const editedTake = () => ({ ...take, name: name.trim() || take.name, notes });
  // A linked take lives only on its card until it is kept.
  const saveMetadata = () =>
    act(async () =>
      linked
        ? recorder.linked.setState({ value: editedTake() })
        : recorder.store.write([editedTake()], { ghost }),
    );
  const keep = () =>
    act(() =>
      linked
        ? recorder.keepLinked(editedTake())
        : recorder.store.write([editedTake()]),
    );
  // A linked take is only dismissed: it was never saved.
  const remove = () =>
    linked
      ? act(async () => recorder.linked.setState({ value: undefined }))
      : onDelete(take.id);
  const measured = measuredSummary(take, values.jointCounts);
  return (
    <article
      className={`take-card ${ghost ? "take-ghost" : ""} ${linked ? "take-linked" : ""}`}
      style={{ "--take-colour": Theme.tape[take.colour] }}
      data-take-id={take.id}
    >
      <label>
        <input type="checkbox" checked={selected} onChange={onSelect} />
        Compare {take.name}
      </label>
      <input
        aria-label={`Name ${take.name}`}
        value={name}
        maxLength={200}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveMetadata}
      />
      <p>
        {ghost
          ? "Automatic snapshot · "
          : linked
            ? "From a link, not saved · "
            : ""}
        Step {take.step} · phase {take.phase.toFixed(4)}
      </p>
      <Distribution
        colour={Theme.tape[take.colour]}
        probabilities={values.joint}
        label={`${take.name} probabilities`}
      />
      <div className="take-readings">
        {values.groups.map((g) => (
          <p key={`${g.start}:${g.name}`}>
            {g.name}:{" "}
            {g.probabilities
              .flatMap((p, i) =>
                p > 1e-9
                  ? [`${g.labels[i] ?? i} ${(100 * p).toFixed(2)}%`]
                  : [],
              )
              .slice(0, 8)
              .join(", ") || "unavailable"}
          </p>
        ))}
      </div>
      {measured !== undefined && <p className="take-measurement">{measured}</p>}
      {Object.entries(take.result.samples).map(([key, v]) => (
        <p key={key}>
          Sample {key}: {v.i}
        </p>
      ))}
      <details>
        <summary>Notes</summary>
        <textarea
          aria-label={`Notes ${take.name}`}
          value={notes}
          maxLength={10000}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveMetadata}
        />
      </details>
      <div className="tape-actions">
        {(ghost || linked) && (
          <button type="button" onClick={keep}>
            Keep
          </button>
        )}
        <button type="button" onClick={() => act(() => recorder.restore(take))}>
          Restore
        </button>
        <button
          type="button"
          onClick={() =>
            act(() => downloadFile(takeJson(take), `${take.id}.json`))
          }
        >
          JSON
        </button>
        <button
          type="button"
          onClick={() =>
            act(() =>
              downloadFile(takeCsv([take]), `${take.id}.csv`, "text/csv"),
            )
          }
        >
          CSV
        </button>
        <CopyButton
          label="Copy JSON"
          title="Snapshot JSON"
          text={() => takeJson(take)}
          fallback="Download this snapshot using JSON, or retry."
        />
        <CopyButton
          label="Copy CSV"
          title="Snapshot CSV"
          text={() => takeCsv([take])}
          fallback="Download this snapshot using CSV, or retry."
        />
        <CopyButton
          label="Copy link"
          title="Snapshot link"
          text={() => takeLink(take, location.href)}
          fallback="Download this snapshot using JSON to share it, or retry."
        />
        <button type="button" onClick={remove}>
          {linked ? "Dismiss" : "Delete"}
        </button>
      </div>
    </article>
  );
}

export { TakeCard };
