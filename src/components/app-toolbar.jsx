import {flushSync} from "react-dom";
import {createRoot} from "react-dom/client";
import {
    AtomIcon,
    EraserIcon,
    MenuIcon,
    RotateCcwIcon,
    RotateCwIcon,
    Share2Icon,
    Trash2Icon,
    WandSparklesIcon
} from "lucide-react";

import {useEffect, useRef} from "react";

import {Button} from "@/components/ui/button";
import {ButtonGroup} from "@/components/ui/button-group";
import {Separator} from "@/components/ui/separator";

// Lucide draws at a 24px grid with a stroke of 2. These render at 16px, so the stroke is
// scaled down to match, which is also what the inline SVGs in the menu use.
const ICON_STROKE_WIDTH = 1.5;

function ToolbarButton({id, icon: Icon, children, variant = "ghost", className}) {
    return (
        <Button id={id} size="default" variant={variant} className={className}>
            <Icon data-icon="inline-start" strokeWidth={ICON_STROKE_WIDTH} />
            {children}
        </Button>
    );
}

/**
 * A toolbar is one tab stop, with the arrow keys moving between its controls (WAI-ARIA's toolbar
 * pattern). Focus state lives in the DOM rather than in React because these buttons are also
 * enabled and disabled imperatively by the non-React ui modules.
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
        // The ui modules toggle `disabled` as the circuit changes; the tab stop follows.
        const observer = new MutationObserver(ensureStop);
        observer.observe(toolbar, {attributes: true, attributeFilter: ['disabled'], subtree: true});

        return () => {
            toolbar.removeEventListener('keydown', onKeyDown);
            toolbar.removeEventListener('focusin', onFocusIn);
            observer.disconnect();
        };
    }, [toolbarRef]);
}

function AppToolbar() {
    const toolbarRef = useRef(null);
    useRovingTabIndex(toolbarRef);

    return (
        <header className="app-toolbar" role="toolbar" aria-label="Circuit controls" ref={toolbarRef}>
            <div className="app-brand" aria-label="Shadow-Quant quantum circuit simulator">
                <span className="app-brand-mark" aria-hidden="true"><AtomIcon strokeWidth={ICON_STROKE_WIDTH} /></span>
                <span className="app-brand-copy">
                    <strong>Shadow-Quant</strong>
                    <small>Quantum circuit simulator</small>
                </span>
            </div>
            <Separator orientation="vertical" className="app-toolbar-separator" />
            <div className="app-toolbar-actions">
                <ButtonGroup aria-label="Application actions">
                    <ToolbarButton id="menu-button" icon={MenuIcon}>Menu</ToolbarButton>
                    <ToolbarButton id="export-button" icon={Share2Icon}>Export</ToolbarButton>
                </ButtonGroup>
                <ToolbarButton id="clear-circuit-button" icon={EraserIcon} variant="outline">
                    Clear Circuit
                </ToolbarButton>
                <ButtonGroup aria-label="History actions">
                    <ToolbarButton id="undo-button" icon={RotateCcwIcon}>Undo</ToolbarButton>
                    <ToolbarButton id="redo-button" icon={RotateCwIcon}>Redo</ToolbarButton>
                </ButtonGroup>
                <ToolbarButton id="gate-forge-button" icon={WandSparklesIcon} variant="outline">
                    Make Gate
                </ToolbarButton>
                {/* Last, and pushed clear of the others: it discards custom gates as well as the
                    circuit, and sitting flush against Clear Circuit made the two easy to confuse. */}
                <ToolbarButton
                    id="clear-all-button"
                    icon={Trash2Icon}
                    variant="destructive"
                    className="app-toolbar-danger">
                    Clear All
                </ToolbarButton>
            </div>
            <span className="app-version">v2.3</span>
        </header>
    );
}

let appToolbarRoot;

function mountAppToolbar() {
    const container = document.getElementById("app-toolbar-root");
    if (container === null) {
        throw new Error("Couldn't find 'app-toolbar-root'");
    }
    if (appToolbarRoot !== undefined) {
        throw new Error("The app toolbar has already been mounted.");
    }

    flushSync(() => {
        appToolbarRoot = createRoot(container);
        appToolbarRoot.render(<AppToolbar />);
    });
}

export {AppToolbar, mountAppToolbar};
