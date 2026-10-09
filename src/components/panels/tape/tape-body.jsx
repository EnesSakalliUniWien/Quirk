import {useStore} from 'zustand';
import { useMemo, useState } from "react";
import { album, takeJson } from "../../../results/files/json.js";
import { takeCsv } from "../../../results/files/csv.js";
import { MAX_FILE_BYTES } from "../../../results/files/limits.js";
import { downloadFile } from "../../../browser/downloadFile.js";
import { TakeCard } from "./take-card.jsx";
import { Compare } from "./compare.jsx";
import { MotionSettings } from "./motion-settings.jsx";

function TapeBody({recorder}) {
    const records = useStore(recorder.store.items, state => state.value);
    const storageError = useStore(recorder.store.error, state => state.value);
    const unsaved = useStore(recorder.unsaved, state => state.value);
    const ghostsEnabled = useStore(recorder.ghostsEnabled, state => state.value);
    const linked = useStore(recorder.linked, state => state.value);
    const [selected, setSelected] = useState([]);
    const [message, setMessage] = useState("");
    const act = async f => {try {await f(); setMessage("");} catch(e) {setMessage(e.message);}};
    // A take opened from a link stands first, unsaved, until it is kept or dismissed.
    const shown = useMemo(() => linked === undefined ? records : [{id: linked.id, take: linked, ghost: false, linked: true},
        ...records.filter(r => r.id !== linked.id)], [records, linked]);
    const selectedTakes = useMemo(() => shown.filter(r => selected.includes(r.id)).map(r => r.take), [shown, selected]);
    const importFile = file => act(async () => {
        if (!file) return;
        if (file.size > MAX_FILE_BYTES) throw new Error("File exceeds 200 MB");
        await recorder.importText(await file.text());
    });
    const saved = records.filter(r => !r.ghost).map(r => r.take);
    return <section className="tape-panel" onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault(); importFile(e.dataTransfer.files[0]);}}>
        <h2>Tape</h2><p>Keep a result, compare two takes, or export an album.</p>
        <div className="tape-actions">
            <label><input id="record-ghosts" type="checkbox" checked={ghostsEnabled} onChange={e => recorder.ghostsEnabled.setState({value: e.target.checked})} />Record a ghost before each edit (last eight kept)</label>
            <label>Import JSON<input aria-label="Import takes" type="file" accept=".json,application/json" onChange={e => {importFile(e.target.files[0]); e.target.value = "";}} /></label>
            <button type="button" onClick={() => downloadFile(takeJson(album(saved)), "tape.json")}>Download album</button>
            <button type="button" onClick={() => downloadFile(takeCsv(saved), "tape.csv", "text/csv")}>Download CSV</button>
        </div>
        <MotionSettings settings={recorder.settings} />
        {(message || storageError) && <p role="alert">{message || storageError}</p>}
        {unsaved.length > 0 && <button type="button" onClick={() => downloadFile(takeJson(album(unsaved)), "unsaved-takes.json")}>Download unsaved takes</button>}
        <div className="tape-strip">{shown.map(record => <TakeCard key={record.id} record={record} recorder={recorder} act={act} selected={selected.includes(record.id)}
            onSelect={() => setSelected(s => s.includes(record.id) ? s.filter(id => id !== record.id) : [...s.slice(-1), record.id])} />)}</div>
        {!shown.length && <p>No takes yet. Press REC to start recording, One take for a single take, or drop a JSON file here.</p>}
        <Compare takes={selectedTakes} />
    </section>;
}

export { TapeBody };
