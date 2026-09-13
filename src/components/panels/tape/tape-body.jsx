import { useMemo, useState } from "react";
import { useObservedValue } from "../../useObservedValue.js";
import { album, takeJson, takeCsv, MAX_FILE_BYTES } from "../../../results/takeFile.js";
import { downloadFile } from "../../../browser/downloadFile.js";
import { TakeCard } from "./take-card.jsx";
import { Compare } from "./compare.jsx";

function TapeBody({recorder}) {
    const records = useObservedValue(recorder.store.items.observable());
    const storageError = useObservedValue(recorder.store.error.observable());
    const unsaved = useObservedValue(recorder.unsaved.observable());
    const ghostsEnabled = useObservedValue(recorder.ghostsEnabled.observable());
    const [selected, setSelected] = useState([]);
    const [message, setMessage] = useState("");
    const act = async f => {try {await f(); setMessage("");} catch(e) {setMessage(e.message);}};
    const selectedTakes = useMemo(() => records.filter(r => selected.includes(r.id)).map(r => r.take), [records, selected]);
    const importFile = file => act(async () => {
        if (!file) return;
        if (file.size > MAX_FILE_BYTES) throw new Error("File exceeds 200 MB");
        await recorder.importText(await file.text());
    });
    const saved = records.filter(r => !r.ghost).map(r => r.take);
    return <section className="tape-panel" onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault(); importFile(e.dataTransfer.files[0]);}}>
        <h2>Tape</h2><p>Keep a result, compare two takes, or export an album.</p>
        <div className="tape-actions">
            <label><input type="checkbox" checked={ghostsEnabled} onChange={e => recorder.ghostsEnabled.set(e.target.checked)} />Keep eight ghosts before edits</label>
            <label>Import JSON<input aria-label="Import takes" type="file" accept=".json,application/json" onChange={e => {importFile(e.target.files[0]); e.target.value = "";}} /></label>
            <button type="button" onClick={() => downloadFile(takeJson(album(saved)), "tape.json")}>Download album</button>
            <button type="button" onClick={() => downloadFile(takeCsv(saved), "tape.csv", "text/csv")}>Download CSV</button>
        </div>
        {(message || storageError) && <p role="alert">{message || storageError}</p>}
        {unsaved.length > 0 && <button type="button" onClick={() => downloadFile(takeJson(album(unsaved)), "unsaved-takes.json")}>Download unsaved takes</button>}
        <div className="tape-strip">{records.map(record => <TakeCard key={record.id} record={record} recorder={recorder} act={act} selected={selected.includes(record.id)}
            onSelect={() => setSelected(s => s.includes(record.id) ? s.filter(id => id !== record.id) : [...s.slice(-1), record.id])} />)}</div>
        {!records.length && <p>No takes yet. Press REC or drop a JSON file here.</p>}
        <Compare takes={selectedTakes} />
    </section>;
}

export { TapeBody };
