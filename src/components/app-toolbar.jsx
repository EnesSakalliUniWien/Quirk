import {flushSync} from "react-dom";
import {createRoot} from "react-dom/client";
import {
    DownloadIcon,
    EraserIcon,
    Redo2Icon,
    Trash2Icon,
    Undo2Icon,
    WandSparklesIcon
} from "lucide-react";

import {useEffect, useRef} from "react";

import {Button} from "@/components/ui/button";
import {ButtonGroup} from "@/components/ui/button-group";

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
 * pattern).
 *
 * Base UI ships a Toolbar whose composite implements this, and it works. It is not used here for
 * two reasons. Its ToolbarRoot never passes `enableHomeAndEndKeys`, so Home and End do nothing.
 * And it derives the set of skippable items from its own React-side item map, which cannot see the
 * `disabled` that the non-React src/app modules set straight on these elements, so arrowing onto a
 * disabled control silently strands focus. Reading `disabled` from the DOM avoids both.
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
        // The src/app modules toggle `disabled` as the circuit changes; the tab stop follows.
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
            <div className="app-toolbar-actions">
                <ToolbarButton id="export-button" icon={DownloadIcon}>Export</ToolbarButton>
                <ToolbarButton id="clear-circuit-button" icon={EraserIcon} variant="outline">
                    Clear Circuit
                </ToolbarButton>
                <ButtonGroup aria-label="History actions">
                    <ToolbarButton id="undo-button" icon={Undo2Icon}>Undo</ToolbarButton>
                    <ToolbarButton id="redo-button" icon={Redo2Icon}>Redo</ToolbarButton>
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
