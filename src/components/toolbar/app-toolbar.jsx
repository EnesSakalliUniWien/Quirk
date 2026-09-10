
import {
    ChartColumnIcon,
    DownloadIcon,
    EraserIcon,
    OrbitIcon,
    Redo2Icon,
    SigmaIcon,
    SquareFunctionIcon,
    Trash2Icon,
    Undo2Icon,
    WandSparklesIcon
} from "lucide-react";

import {useEffect, useRef} from "react";
import {useStore} from "zustand";

import {Button} from "@/components/ui/button";
import {appStore} from "../../state/appStore.js";
import {openPanel} from "../dock.jsx";

// Lucide draws at a 24px grid with a stroke of 2. These render at 16px, so the stroke is
// scaled down to match, which is also what the inline SVGs in the menu use.
const ICON_STROKE_WIDTH = 1.5;

function ToolbarButton({id, icon: Icon, label, className, disabled, onClick}) {
    return (
        <Button
            id={id}
            size="icon"
            className={className}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}>
            <Icon strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        </Button>
    );
}

/**
 * A toolbar is one tab stop, with the arrow keys moving between its controls (WAI-ARIA's toolbar
 * pattern).
 *
 * Base UI ships a Toolbar whose composite implements this, and it works. It is not used here for
 * two reasons. Its ToolbarRoot never passes `enableHomeAndEndKeys`, so Home and End do nothing.
 * And it derives the set of skippable items from its own React-side item map, which lags the
 * `disabled` these buttons take from the app store, so arrowing onto a disabled control can
 * strand focus. Reading `disabled` from the DOM avoids both.
 */
function useRovingTabIndex(toolbarRef) {
    useEffect(() => {
        const toolbar = toolbarRef.current;
        if (toolbar === null) {
            return undefined;
        }

        const items = () => [...toolbar.querySelectorAll('[data-slot="button"]')];
        const enabled = () => items().filter(b => !b.disabled);
        const setStop = stop => {
            for (const b of items()) {
                b.tabIndex = b === stop ? 0 : -1;
            }
        };

        // Collapse to exactly one tab stop, on an enabled control. Buttons default to tabIndex 0,
        // so without this the whole toolbar is a tab stop per button until the first keypress.
        const ensureStop = () => {
            const usable = enabled();
            if (usable.length === 0) {
                return;
            }
            const stops = items().filter(b => b.tabIndex === 0);
            if (stops.length !== 1 || stops[0].disabled) {
                setStop(usable[0]);
            }
        };

        const onKeyDown = event => {
            const usable = enabled();
            const from = usable.indexOf(document.activeElement);
            if (from === -1 || usable.length === 0) {
                return;
            }
            let to;
            switch (event.key) {
                case 'ArrowRight': to = Math.min(from + 1, usable.length - 1); break;
                case 'ArrowLeft': to = Math.max(from - 1, 0); break;
                case 'Home': to = 0; break;
                case 'End': to = usable.length - 1; break;
                default: return;
            }
            event.preventDefault();
            setStop(usable[to]);
            usable[to].focus();
        };

        const onFocusIn = event => {
            const target = event.target;
            if (items().includes(target) && !target.disabled) {
                setStop(target);
            }
        };

        ensureStop();
        toolbar.addEventListener('keydown', onKeyDown);
        toolbar.addEventListener('focusin', onFocusIn);
        // `disabled` follows the circuit through the store; the tab stop follows it.
        const observer = new MutationObserver(ensureStop);
        observer.observe(toolbar, {attributes: true, attributeFilter: ['disabled'], subtree: true});

        return () => {
            toolbar.removeEventListener('keydown', onKeyDown);
            toolbar.removeEventListener('focusin', onFocusIn);
            observer.disconnect();
        };
    }, [toolbarRef]);
}

/**
 * Ctrl+Z / Cmd+Z undoes and Ctrl+Shift+Z, Cmd+Shift+Z or Ctrl+Y redoes, wherever focus is.
 * The shortcuts read the same availability the buttons do, so the two stay in sync.
 */
function useUndoRedoShortcuts() {
    useEffect(() => {
        const onKeyDown = e => {
            // Control on Windows and Linux, command on macOS.
            if (!(e.ctrlKey || e.metaKey) || e.altKey) {
                return;
            }
            const key = e.key.toLowerCase();
            const isUndo = key === 'z' && !e.shiftKey;
            const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey);
            const {circuitActions, circuitAvailability} = appStore.getState();
            if (circuitActions === undefined) {
                return;
            }
            if (isUndo && circuitAvailability.canUndo) {
                circuitActions.undo();
                e.preventDefault();
            } else if (isRedo && circuitAvailability.canRedo) {
                circuitActions.redo();
                e.preventDefault();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);
}

function AppToolbar() {
    const toolbarRef = useRef(null);
    useRovingTabIndex(toolbarRef);
    useUndoRedoShortcuts();

    const availability = useStore(appStore, s => s.circuitAvailability);
    const circuitActions = useStore(appStore, s => s.circuitActions);

    return (
        <header className="app-toolbar" role="toolbar" aria-label="Circuit controls" ref={toolbarRef}>
            <ToolbarButton
                id="export-button"
                icon={DownloadIcon}
                label="Export"
                onClick={() => openPanel("export")} />
            <ToolbarButton
                id="state-button"
                icon={SigmaIcon}
                label="State"
                onClick={() => openPanel("state")} />
            <ToolbarButton
                id="algebra-button"
                icon={SquareFunctionIcon}
                label="Algebra"
                onClick={() => openPanel("algebra")} />
            <ToolbarButton
                id="probabilities-button"
                icon={ChartColumnIcon}
                label="Probabilities"
                onClick={() => openPanel("probabilities")} />
            <ToolbarButton
                id="qubits-button"
                icon={OrbitIcon}
                label="Qubits"
                onClick={() => openPanel("qubits")} />
            <ToolbarButton
                id="clear-circuit-button"
                icon={EraserIcon}
                label="Clear Circuit"
                disabled={!availability.canClearCircuit}
                onClick={() => circuitActions.clearCircuit()} />
            <ToolbarButton
                id="undo-button"
                icon={Undo2Icon}
                label="Undo"
                disabled={!availability.canUndo}
                onClick={() => circuitActions.undo()} />
            <ToolbarButton
                id="redo-button"
                icon={Redo2Icon}
                label="Redo"
                disabled={!availability.canRedo}
                onClick={() => circuitActions.redo()} />
            <ToolbarButton
                id="gate-forge-button"
                icon={WandSparklesIcon}
                label="Make Gate"
                onClick={() => openPanel("forge")} />
            {/* Last, and pushed clear of the others by its auto margin: it discards custom gates
                as well as the circuit, and sitting flush against the rest made it easy to hit
                by mistake. Distinguished by colour, not by size. */}
            <ToolbarButton
                id="clear-all-button"
                icon={Trash2Icon}
                label="Clear All"
                className="app-toolbar-danger"
                disabled={!availability.canClearAll}
                onClick={() => circuitActions.clearAll()} />
        </header>
    );
}

export {AppToolbar};
