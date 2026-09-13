import { useStore } from "zustand";
import { appStore } from "../../../state/appStore.js";
import { ReadyControls } from "./ready-controls.jsx";

function RecordControls() {
    const recorder = useStore(appStore, s => s.recorder);
    return recorder === undefined ? null : <ReadyControls recorder={recorder} />;
}

export { RecordControls };
