import { useEffect, useRef, useState } from "react";
import { openPanel } from "../../dock.jsx";
import { useObservedValue } from "../../useObservedValue.js";

function ReadyControls({recorder}) {
    const busy = useObservedValue(recorder.busy.observable());
    const timer = useRef();
    const held = useRef(false);
    useEffect(() => () => clearTimeout(timer.current), []);
    const [error, setError] = useState("");
    const run = async whole => {
        openPanel("tape");
        setError("");
        try {await (whole ? recorder.recordRun() : recorder.record());}
        catch (e) {setError(e.message);}
    };
    const release = () => clearTimeout(timer.current);
    return <>
        <button id="record-take" type="button" disabled={busy}
            onPointerDown={() => {held.current = false; timer.current = setTimeout(() => {held.current = true; run(true);}, 600);}}
            onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
            onClick={event => {if (!held.current || event.detail === 0) run(false); held.current = false;}}>REC</button>
        <button id="record-run" type="button" disabled={busy} onClick={() => run(true)}>Record whole run</button>
        {busy && <button type="button" onClick={() => recorder.cancel()}>Cancel recording</button>}
        {error && <span role="alert">{error}</span>}
    </>;
}

export { ReadyControls };
