import {AppDialog} from "./app-dialog.jsx";

/**
 * The welcome overlay: the app's greeting, resource links, and example circuits. Its panel markup
 * ships in quirk.html's dialog stash and is wired up by src/ui/menu.js.
 */
function MenuDialog({active, overlayState}) {
    return (
        <AppDialog
            name="menu" divId="menu-div" contentId="menu-dialog-content"
            labelledBy="welcome-title"
            active={active} overlayState={overlayState} />
    );
}

export {MenuDialog};
