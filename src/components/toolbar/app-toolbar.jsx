
import {Menu} from "@base-ui/react/menu";
import {EllipsisIcon, EraserIcon, Redo2Icon, Trash2Icon, Undo2Icon} from "lucide-react";

import {Fragment, useEffect, useLayoutEffect, useRef, useState} from "react";
import {useStore} from "zustand";

import {Button} from "@/components/ui/button";
import {appStore} from "../../state/appStore.js";
import {openPanel} from "../dock.jsx";
import {PANELS} from "../panels/panels.jsx";
import {ExamplesMenu} from "./examples-menu.jsx";
import {isApplePlatform, shortcut} from "../../browser/platform.js";
import {isTypingTarget} from "../../browser/typingTarget.js";

/**
 * The toolbar's panel buttons, in the groups after the circuit's own: making and tuning gates, then
 * the panels that read the circuit out and the ways it leaves the app. When the window is too narrow
 * for all of them, they move into the More menu from the end, the least used first. The circuit
 * group before them - its examples and its history - and Clear all after them always stay.
 */
const PANEL_GROUPS = Object.freeze([
    Object.freeze([["forge", "gate-forge-button"], ["gate-param", "gate-parameter-button"]]),
    Object.freeze([["state", "state-button"], ["probabilities", "probabilities-button"], ["qubits", "qubits-button"],
        ["registers", "registers-button"], ["algebra", "algebra-button"], ["tape", "tape-button"],
        ["export", "export-button"]]),
]);
/** The buttons that never move into the More menu: Examples, Undo, Redo, Clear circuit, Clear all. */
const FIXED_BUTTONS = 5;
/** The least room between Clear all and the button before it, so it is never hit by mistake. */
const CLEAR_ALL_SPACE = 12;
/** Words that title-style capitalization leaves in lower case inside a label. */
const MINOR_WORDS = new Set(["a", "an", "the", "and", "or", "nor", "but", "as", "at", "by", "for", "from",
    "in", "into", "of", "on", "onto", "to", "with"]);

/**
 * @param {!string} label A panel's title, in sentence case like every button.
 * @returns {!string} The label in title-style capitalization, as a menu item takes it.
 */
function titleStyle(label) {
    const words = label.split(" ");
    return words.map((word, i) => i > 0 && i < words.length - 1 && MINOR_WORDS.has(word) ? word :
        word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

// The stroke comes from the app's IconProvider (src/components/ui/icon.jsx), so no icon here
// carries a weight of its own.
function ToolbarButton({id, icon: Icon, label, tooltip = label, className, disabled, onClick}) {
    return (
        <Button
            id={id}
            size="icon"
            className={className}
            aria-label={label}
            title={tooltip}
            disabled={disabled}
            onClick={onClick}>
            <Icon aria-hidden="true" />
        </Button>
    );
}

function ToolbarSeparator() {
    return <div className="app-toolbar-separator" role="separator" aria-orientation="vertical" />;
}

/**
 * The panel buttons that did not fit, as items of a menu at the end of the row: the same icon and
 * name, the name in the capitalization menu items take.
 *
 * @param {!{items: !Array.<!{panel: !string, id: !string}>}} props
 */
function MoreMenu({items}) {
    return (
        <Menu.Root>
            <Menu.Trigger render={<Button id="toolbar-more-button" size="icon" aria-label="More" title="More" />}>
                <EllipsisIcon aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
                <Menu.Positioner className="app-menu-positioner" side="bottom" align="end" sideOffset={4}>
                    <Menu.Popup className="app-menu" aria-label="More">
                        {items.map(({panel, id}) => {
                            const {icon: Icon, title} = PANELS[panel];
                            return (
                                <Menu.Item key={panel} className="app-menu-item" data-toolbar-item={id}
                                    onClick={() => openPanel(panel)}>
                                    <span className="app-menu-item-label">
                                        <Icon className="app-menu-item-icon" aria-hidden="true" />
                                        {titleStyle(title)}
                                    </span>
                                </Menu.Item>
                            );
                        })}
                    </Menu.Popup>
                </Menu.Positioner>
            </Menu.Portal>
        </Menu.Root>
    );
}

/**
 * @param {!number} hidden How many panel buttons are in the More menu.
 * @returns {!{shown: !Array.<!Array.<!Array.<!string>>>, hidden: !Array.<!{panel: !string, id: !string}>}}
 *     The groups with the buttons that stay, and the ones that move, in their toolbar order.
 */
function splitPanelGroups(hidden) {
    let remaining = hidden;
    const shown = [...PANEL_GROUPS].reverse().map(group => {
        const cut = Math.min(remaining, group.length);
        remaining -= cut;
        return group.slice(0, group.length - cut);
    }).reverse();
    const moved = PANEL_GROUPS.flat().slice(shown.flat().length).map(([panel, id]) => ({panel, id}));
    return {shown, hidden: moved};
}

/**
 * How many panel buttons move into the More menu for the toolbar to fit its width: none when the
 * window is wide enough, and one more for each button's width less there is. The buttons are icon
 * buttons of one size, so the widths are measured once from the ones on screen.
 *
 * @param {!{current: (null|!HTMLElement)}} toolbarRef
 * @returns {!number}
 */
function useOverflow(toolbarRef) {
    const [hidden, setHidden] = useState(0);
    const separatorWidth = useRef(undefined);
    useLayoutEffect(() => {
        const toolbar = toolbarRef.current;
        if (toolbar === null) {
            return undefined;
        }
        const measure = () => {
            const button = toolbar.querySelector("#undo-button");
            const separator = toolbar.querySelector(".app-toolbar-separator");
            const style = getComputedStyle(toolbar);
            const gap = Number.parseFloat(style.columnGap) || 0;
            if (separator !== null) {
                const s = getComputedStyle(separator);
                separatorWidth.current = separator.offsetWidth + Number.parseFloat(s.marginLeft) +
                    Number.parseFloat(s.marginRight) + gap;
            }
            if (button === null || separatorWidth.current === undefined) {
                return;
            }
            const unit = button.offsetWidth + gap;
            const room = toolbar.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
            const total = PANEL_GROUPS.flat().length;
            let fits = total;
            for (let k = 0; k <= total; k++) {
                const {shown} = splitPanelGroups(k);
                const buttons = FIXED_BUTTONS + shown.flat().length + (k > 0 ? 1 : 0);
                const separators = shown.filter(group => group.length > 0).length;
                if (buttons * unit + separators * separatorWidth.current + CLEAR_ALL_SPACE <= room) {
                    fits = k;
                    break;
                }
            }
            setHidden(fits);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(toolbar);
        return () => observer.disconnect();
    }, [toolbarRef]);
    return hidden;
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
        // `disabled` follows the circuit through the store, and buttons move into the More menu and
        // back as the window's width changes; the tab stop follows both.
        const observer = new MutationObserver(ensureStop);
        observer.observe(toolbar, {attributes: true, attributeFilter: ['disabled'], subtree: true, childList: true});

        return () => {
            toolbar.removeEventListener('keydown', onKeyDown);
            toolbar.removeEventListener('focusin', onFocusIn);
            observer.disconnect();
        };
    }, [toolbarRef]);
}

/**
 * ⌘Z undoes and ⇧⌘Z redoes on Apple platforms, where Command-Y means something else; elsewhere
 * Ctrl+Z undoes and Ctrl+Shift+Z or Ctrl+Y redoes. Wherever focus is, except in a text field. The
 * shortcuts read the same availability the buttons do, so the two stay in sync.
 */
function useUndoRedoShortcuts() {
    useEffect(() => {
        const onKeyDown = e => {
            if (e.defaultPrevented || isTypingTarget(e)) return;
            // Control on Windows and Linux, command on macOS.
            if (!(e.ctrlKey || e.metaKey) || e.altKey) {
                return;
            }
            const key = e.key.toLowerCase();
            const isUndo = key === 'z' && !e.shiftKey;
            const isRedo = (key === 'z' && e.shiftKey) || (!isApplePlatform && e.ctrlKey && key === 'y' && !e.shiftKey);
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

/**
 * The toolbar, in three groups by what the buttons do - the circuit itself, making gates, reading
 * the circuit out - with Clear all apart at the end. Each panel button carries its panel's own mark
 * and name.
 */
function AppToolbar() {
    const toolbarRef = useRef(null);
    useRovingTabIndex(toolbarRef);
    useUndoRedoShortcuts();
    const {shown, hidden} = splitPanelGroups(useOverflow(toolbarRef));

    const availability = useStore(appStore, s => s.circuitAvailability);
    const circuitActions = useStore(appStore, s => s.circuitActions);

    return (
        <header className="app-toolbar" role="toolbar" aria-label="Circuit controls" ref={toolbarRef}>
            <ExamplesMenu />
            <ToolbarButton
                id="undo-button"
                icon={Undo2Icon}
                label="Undo"
                tooltip={`Undo (${shortcut("Z")})`}
                disabled={!availability.canUndo}
                onClick={() => circuitActions.undo()} />
            <ToolbarButton
                id="redo-button"
                icon={Redo2Icon}
                label="Redo"
                tooltip={`Redo (${shortcut("Z", {shift: true})})`}
                disabled={!availability.canRedo}
                onClick={() => circuitActions.redo()} />
            <ToolbarButton
                id="clear-circuit-button"
                icon={EraserIcon}
                label="Clear circuit"
                disabled={!availability.canClearCircuit}
                onClick={() => circuitActions.clearCircuit()} />
            {shown.map((group, index) => group.length === 0 ? null : (
                <Fragment key={index}>
                    <ToolbarSeparator />
                    {group.map(([panel, id]) => (
                        <ToolbarButton key={panel} id={id} icon={PANELS[panel].icon} label={PANELS[panel].title}
                            onClick={() => openPanel(panel)} />
                    ))}
                </Fragment>
            ))}
            {hidden.length > 0 && <MoreMenu items={hidden} />}
            {/* Last, and pushed clear of the others by its auto margin: it discards custom gates
                as well as the circuit, and sitting flush against the rest made it easy to hit
                by mistake. Distinguished by colour, not by size. */}
            <ToolbarButton
                id="clear-all-button"
                icon={Trash2Icon}
                label="Clear all"
                className="app-toolbar-danger"
                disabled={!availability.canClearAll}
                onClick={() => circuitActions.clearAll()} />
        </header>
    );
}

export {AppToolbar};
