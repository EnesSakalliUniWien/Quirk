import {flushSync} from "react-dom";
import {createRoot} from "react-dom/client";

import {SearchIcon} from "lucide-react";

/**
 * The gate palette. The tiles themselves are built by src/ui/toolbox.js as symbol chips beside
 * names; only the tooltips still come from the painter the circuit uses. This is the shell
 * around them.
 */
function GateToolbox() {
    return (
        <aside className="gate-toolbox" aria-label="Gates">
            <div className="gate-toolbox-search">
                <SearchIcon className="gate-toolbox-search-icon" strokeWidth={1.5} aria-hidden="true" />
                <input
                    id="gate-search"
                    type="search"
                    className="gate-toolbox-search-input"
                    placeholder="Search gates"
                    aria-label="Search gates"
                    autoComplete="off"
                    spellCheck="false" />
            </div>
            <div id="gate-toolbox-groups" className="gate-toolbox-groups" />
            <p id="gate-toolbox-empty" className="gate-toolbox-empty" hidden>
                No gate matches that search.
            </p>
        </aside>
    );
}

let gateToolboxRoot;

function mountGateToolbox() {
    const container = document.getElementById("gate-toolbox-root");
    if (container === null) {
        throw new Error("Couldn't find 'gate-toolbox-root'");
    }
    if (gateToolboxRoot !== undefined) {
        throw new Error("The gate toolbox has already been mounted.");
    }

    flushSync(() => {
        gateToolboxRoot = createRoot(container);
        gateToolboxRoot.render(<GateToolbox />);
    });
}

export {GateToolbox, mountGateToolbox};
