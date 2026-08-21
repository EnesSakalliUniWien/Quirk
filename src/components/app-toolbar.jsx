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

function AppToolbar() {
    return (
        <header className="app-toolbar" role="toolbar" aria-label="Circuit controls">
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
