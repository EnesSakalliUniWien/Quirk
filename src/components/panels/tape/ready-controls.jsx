import {useStore} from 'zustand';
import { useEffect, useRef, useState } from "react";
import { openPanel } from "../../dock.jsx";

/**
 * What a screen reader is told about a recording: that it started, at which rate, and that it
 * stopped, with how many takes. The running count on screen changes with every sample and is not
 * announced, so the announcements never crowd out anything else.
 */
function recordingAnnouncement(recording, busy, rate, samples) {
    if (recording) return `Recording started, a take ${rate}.`;
    if (busy) return "Recording the whole run.";
    return samples > 0 ? `Recording stopped, ${samples} ${samples === 1 ? "take" : "takes"} saved.` : "";
}

/**
 * Each control does one thing: Record starts a recording and Stop ends it, "One take" records one
 * take, and "Whole run" records every step. Nothing records until one of them is pressed.
 * While a recording or a whole run is under way, the indicator says so, in the place of the two
 * buttons that cannot be used meanwhile, so the transport bar keeps its size. The focus goes with
 * a pressed button that gives its place up - Whole run's to Cancel - and comes back after.
 */
function ReadyControls({recorder}) {
    const busy = useStore(recorder.busy, state => state.value);
    const recording = useStore(recorder.recording, state => state.value);
    const samples = useStore(recorder.samples, state => state.value);
    const recordingError = useStore(recorder.recordingError, state => state.value);
    const sampleRateHz = useStore(recorder.settings, state => state.sampleRateHz);
    const [error, setError] = useState("");
    const runButton = useRef(null);
    const cancelButton = useRef(null);
    const focusFollowsRun = useRef(false);
    useEffect(() => {
        if (!focusFollowsRun.current) return;
        if (busy) {
            cancelButton.current?.focus();
            return;
        }
        focusFollowsRun.current = false;
        if (document.activeElement === null || document.activeElement === document.body) runButton.current?.focus();
    }, [busy]);
    const run = async whole => {
        openPanel("tape");
        setError("");
        focusFollowsRun.current = whole && document.activeElement === runButton.current;
        try {await (whole ? recorder.recordRun() : recorder.record());}
        catch (e) {setError(e.message);}
    };
    const toggle = () => {
        if (recording) {
            recorder.stop();
            return;
        }
        openPanel("tape");
        setError("");
        recorder.start();
    };
    const perSecond = Number(sampleRateHz.toPrecision(3));
    const rate = `${perSecond} per second`;
    // The toggle's label says what it does next; its state is told by the label and the status, not
    // by aria-pressed as well.
    return <span className="record-controls" role="group" aria-label="Recording">
        <button id="record-toggle" type="button" className="record-toggle" disabled={busy} data-recording={recording}
            title={recording ? "Stop recording" : `Start recording: a take ${rate}`} onClick={toggle}>
            {recording ? "Stop" : "Record"}
        </button>
        <button id="record-take" type="button" hidden={busy || recording} aria-label="Record one take" title="Record one take"
            onClick={() => run(false)}>One take</button>
        <button id="record-run" type="button" ref={runButton} hidden={busy || recording} aria-label="Record the whole run"
            title="Record every step of the run, at one phase" onClick={() => run(true)}>Whole run</button>
        {busy && <button type="button" ref={cancelButton} onClick={() => recorder.cancel()}>Cancel recording</button>}
        <span id="recording-indicator" className="recording-indicator" aria-hidden="true" hidden={!recording && !busy}>
            <span className="recording-dot" />
            {recording ? `Recording · ${perSecond}/s · ${samples} ${samples === 1 ? "take" : "takes"}` : busy ? "Recording whole run" : ""}
        </span>
        <span id="recording-status" className="visually-hidden" role="status">{recordingAnnouncement(recording, busy, rate, samples)}</span>
        {(error || recordingError) && <span role="alert">{error || recordingError}</span>}
    </span>;
}

export { ReadyControls };
