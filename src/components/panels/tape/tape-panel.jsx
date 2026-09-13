import { useStore } from "zustand";
import { appStore } from "../../../state/appStore.js";
import { TapeBody } from "./tape-body.jsx";

function TapePanel() {
    const recorder = useStore(appStore, s => s.recorder);
    return recorder ? <TapeBody recorder={recorder} /> : <p>Opening Tape…</p>;
}

export { TapePanel };
