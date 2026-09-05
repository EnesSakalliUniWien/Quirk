import {flushSync} from "react-dom";
import {createRoot} from "react-dom/client";

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    PauseIcon,
    PlayIcon,
    SkipBackIcon,
    SkipForwardIcon
} from "lucide-react";

import {Button} from "@/components/ui/button";
import {ButtonGroup} from "@/components/ui/button-group";

/** Matches the app toolbar, so the two strips read as one set of controls. */
const ICON_STROKE_WIDTH = 1.5;

function TransportButton({id, icon: Icon, children}) {
    return (
        <Button id={id} size="default" variant="ghost">
            <Icon data-icon="inline-start" strokeWidth={ICON_STROKE_WIDTH} />
            {children}
        </Button>
    );
}

/**
 * Steps the circuit a column at a time.
 *
 * This is a group rather than a toolbar: the toolbar pattern puts the whole strip on one tab stop
 * and moves between its controls with the arrow keys, which are the keys the scrub slider needs for
 * its own value. Each control is its own tab stop instead, the way media controls usually are.
 *
 * The labels and the readout follow ket's GUI debugger (github.com/brenocq/ket), except that its
 * ASCII arrows in "< Prev" and "Next >" are drawn glyphs here, like every other arrow in the app.
 */
function TransportBar() {
    return (
        <div className="transport-bar" role="group" aria-label="Playback controls">
            <ButtonGroup aria-label="Playhead">
                <TransportButton id="playhead-reset-button" icon={SkipBackIcon}>Reset</TransportButton>
                <TransportButton id="playhead-prev-button" icon={ChevronLeftIcon}>Prev</TransportButton>
                {/* Both glyphs are rendered and one is hidden, because src/app/transport.js swaps
                    them as the playhead starts and stops rather than re-rendering this tree. */}
                <Button id="playhead-play-button" size="default" variant="ghost">
                    <PlayIcon id="playhead-play-icon" data-icon="inline-start"
                              strokeWidth={ICON_STROKE_WIDTH} />
                    <PauseIcon id="playhead-pause-icon" data-icon="inline-start"
                               strokeWidth={ICON_STROKE_WIDTH} hidden />
                    <span id="playhead-play-label">Play</span>
                </Button>
                <TransportButton id="playhead-next-button" icon={ChevronRightIcon}>Next</TransportButton>
                <TransportButton id="playhead-end-button" icon={SkipForwardIcon}>End</TransportButton>
            </ButtonGroup>
            <input
                id="playhead-scrub"
                className="transport-scrub"
                type="range"
                min="0"
                max="0"
                step="1"
                defaultValue="0"
                aria-label="Scrub to a gate"
                aria-describedby="playhead-position" />
            <span id="playhead-position" className="transport-position">gate 0 / 0</span>
        </div>
    );
}

let transportBarRoot;

function mountTransportBar() {
    const container = document.getElementById("transport-bar-root");
    if (container === null) {
        throw new Error("Couldn't find 'transport-bar-root'");
    }
    if (transportBarRoot !== undefined) {
        throw new Error("The transport bar has already been mounted.");
    }

    flushSync(() => {
        transportBarRoot = createRoot(container);
        transportBarRoot.render(<TransportBar />);
    });
}

export {TransportBar, mountTransportBar};
