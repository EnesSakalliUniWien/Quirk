import { useStore } from "zustand";
import { useEffect, useMemo, useRef, useState } from "react";
import { album, takeJson } from "../../../results/files/json.js";
import { takeCsv } from "../../../results/files/csv.js";
import { MAX_FILE_BYTES } from "../../../results/files/limits.js";
import { downloadFile } from "../../../browser/downloadFile.js";
import { TakeCard } from "./take-card.jsx";
import { Compare } from "./compare.jsx";
import { MotionSettings } from "./motion-settings.jsx";

function TapeBody({ recorder }) {
  const records = useStore(recorder.store.items, (state) => state.value);
  const storageError = useStore(recorder.store.error, (state) => state.value);
  const unsaved = useStore(recorder.unsaved, (state) => state.value);
  const ghostsEnabled = useStore(
    recorder.ghostsEnabled,
    (state) => state.value,
  );
  const linked = useStore(recorder.linked, (state) => state.value);
  const recovery = useStore(
    recorder.store.recovery,
    (state) => /** @type {{value: any}} */ (state).value,
  );
  const recovering = useStore(
    recorder.store.recovering,
    (state) => /** @type {{value: boolean}} */ (state).value,
  );
  const undoButton = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const section = useRef(/** @type {HTMLElement | null} */ (null));
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("");
  const act = async (f) => {
    try {
      await f();
      if (mounted.current) setMessage("");
    } catch (e) {
      if (mounted.current) setMessage(e.message);
    }
  };
  // A take opened from a link stands first, unsaved, until it is kept or dismissed.
  const shown = useMemo(
    () =>
      linked === undefined
        ? records
        : [
            { id: linked.id, take: linked, ghost: false, linked: true },
            ...records.filter((r) => r.id !== linked.id),
          ],
    [records, linked],
  );
  useEffect(() => {
    setSelected((s) => s.filter((id) => shown.some((r) => r.id === id)));
  }, [shown]);
  const deleteTake = (id) =>
    act(async () => {
      await recorder.store.delete(id);
      if (mounted.current)
        requestAnimationFrame(() => undoButton.current?.focus());
    });
  const undoDeletion = () =>
    act(async () => {
      const id = recorder.store.recovery.getState().value?.id;
      await recorder.store.undoDelete();
      if (mounted.current && !recorder.store.recovery.getState().value)
        requestAnimationFrame(() => {
          const card = [
            ...(section.current?.querySelectorAll("[data-take-id]") ?? []),
          ].find((card) => card.getAttribute("data-take-id") === id);
          /** @type {HTMLInputElement | null | undefined} */
          const name = card?.querySelector('input[aria-label^="Name"]');
          name?.focus();
        });
    });
  const selectedTakes = useMemo(
    () => shown.filter((r) => selected.includes(r.id)).map((r) => r.take),
    [shown, selected],
  );
  const importFile = (file) =>
    act(async () => {
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) throw new Error("File exceeds 200 MB");
      await recorder.importText(await file.text());
    });
  const saved = records.filter((r) => !r.ghost).map((r) => r.take);
  return (
    <section
      ref={section}
      className="tape-panel"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        importFile(e.dataTransfer.files[0]);
      }}
    >
      <h2>Recordings</h2>
      <p>Keep a result, compare two snapshots, or export a collection.</p>
      <div className="tape-actions">
        <label>
          <input
            id="record-ghosts"
            type="checkbox"
            checked={ghostsEnabled}
            onChange={(e) =>
              recorder.ghostsEnabled.setState({ value: e.target.checked })
            }
          />
          Record a snapshot before each edit, keeping the eight most recent
        </label>
        <label>
          Import JSON
          <input
            aria-label="Import snapshots"
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              importFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() =>
            downloadFile(takeJson(album(saved)), "recordings.json")
          }
        >
          Download collection
        </button>
        <button
          type="button"
          onClick={() =>
            downloadFile(takeCsv(saved), "recordings.csv", "text/csv")
          }
        >
          Download CSV
        </button>
      </div>
      {recovery && (
        <div className="tape-actions" role="status">
          <span>Deleted {recovery.take.name}.</span>
          <button
            ref={undoButton}
            type="button"
            disabled={recovering}
            onClick={undoDeletion}
          >
            Undo deletion
          </button>
          <button
            type="button"
            onClick={() =>
              act(() =>
                downloadFile(takeJson(recovery.take), `${recovery.id}.json`),
              )
            }
          >
            Download deleted snapshot
          </button>
          <button
            type="button"
            disabled={recovering}
            onClick={() => act(() => recorder.store.dismissRecovery())}
          >
            Dismiss recovery
          </button>
        </div>
      )}
      <MotionSettings settings={recorder.settings} />
      {(message || storageError) && (
        <p role="alert">{message || storageError}</p>
      )}
      {unsaved.length > 0 && (
        <button
          type="button"
          onClick={() =>
            downloadFile(takeJson(album(unsaved)), "unsaved-snapshots.json")
          }
        >
          Download unsaved snapshots
        </button>
      )}
      <div className="tape-strip">
        {shown.map((record) => (
          <TakeCard
            key={record.id}
            record={record}
            recorder={recorder}
            act={act}
            onDelete={deleteTake}
            selected={selected.includes(record.id)}
            onSelect={() =>
              setSelected((s) =>
                s.includes(record.id)
                  ? s.filter((id) => id !== record.id)
                  : [...s.slice(-1), record.id],
              )
            }
          />
        ))}
      </div>
      {!shown.length && (
        <p>No snapshots yet. Select Record or drop a JSON file here.</p>
      )}
      <Compare takes={selectedTakes} />
    </section>
  );
}

export { TapeBody };
