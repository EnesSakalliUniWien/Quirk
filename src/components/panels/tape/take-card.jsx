import { useMemo, useState } from "react";
import { distributions } from "../../../results/take/distributions.js";
import { takeJson } from "../../../results/files/json.js";
import { takeCsv } from "../../../results/files/csv.js";
import { takeLink } from "../../../results/files/link.js";
import { downloadFile } from "../../../browser/downloadFile.js";
import { COLOURS } from "./colours.js";
import { Distribution } from "./distribution.jsx";

function TakeCard({record, selected, onSelect, recorder, act}) {
    const {take, ghost} = record;
    const values = useMemo(() => distributions(take), [take]);
    const [name, setName] = useState(take.name);
    const [notes, setNotes] = useState(take.notes);
    const editedTake = () => ({...take, name: name.trim() || take.name, notes});
    const saveMetadata = () => act(() => recorder.store.write([editedTake()], {ghost}));
    return <article className={`take-card ${ghost ? "take-ghost" : ""}`} style={{"--take-colour": COLOURS[take.colour]}} data-take-id={take.id}>
        <label><input type="checkbox" checked={selected} onChange={onSelect} />Compare {take.name}</label>
        <input aria-label={`Name ${take.name}`} value={name} maxLength={200} onChange={e => setName(e.target.value)} onBlur={saveMetadata} />
        <p>{ghost ? "Ghost · " : ""}Step {take.step} · phase {take.phase.toFixed(4)}</p>
        <Distribution colour={COLOURS[take.colour]} probabilities={values.joint} label={`${take.name} probabilities`} />
        <div className="take-readings">{values.groups.map(g => <p key={`${g.start}:${g.name}`}>{g.name}: {g.probabilities.flatMap((p,i) => p > 1e-9 ? [`${g.labels[i] ?? i} ${(100*p).toFixed(2)}%`] : []).slice(0,8).join(", ") || "unavailable"}</p>)}</div>
        {Object.entries(take.result.samples).map(([key, v]) => <p key={key}>Sample {key}: {v.i}</p>)}
        <details><summary>Notes</summary><textarea aria-label={`Notes ${take.name}`} value={notes} maxLength={10000} onChange={e => setNotes(e.target.value)} onBlur={saveMetadata} /></details>
        <div className="tape-actions">
            {ghost && <button type="button" onClick={() => act(() => recorder.store.write([editedTake()]))}>Keep</button>}
            <button type="button" onClick={() => act(() => recorder.restore(take))}>Restore</button>
            <button type="button" onClick={() => act(() => downloadFile(takeJson(take), `${take.id}.json`))}>JSON</button>
            <button type="button" onClick={() => act(() => downloadFile(takeCsv([take]), `${take.id}.csv`, "text/csv"))}>CSV</button>
            <button type="button" onClick={() => act(() => navigator.clipboard.writeText(takeJson(take)))}>Copy JSON</button>
            <button type="button" onClick={() => act(() => navigator.clipboard.writeText(takeCsv([take])))}>Copy CSV</button>
            <button type="button" onClick={() => act(() => navigator.clipboard.writeText(takeLink(take, location.href)))}>Copy link</button>
            <button type="button" onClick={() => act(() => recorder.store.write([], {remove: [take.id]}))}>Delete</button>
        </div>
    </article>;
}

export { TakeCard };
