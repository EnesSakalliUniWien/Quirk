/**
 * Whether the page runs on an Apple platform, where Command is the shortcut modifier and the
 * standard shortcuts are the Mac's own: redo is Shift-Command-Z, and Command-Y means something else.
 * @type {!boolean}
 */
export const isApplePlatform = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * @param {!string} key
 * @param {!{shift: (undefined|!boolean)}=} options
 * @returns {!string} The key with the platform's command modifier, written the platform's way, as a
 *     tooltip or a toast names it: ⇧⌘Z on Apple platforms, where Shift comes before Command, and
 *     Ctrl+Shift+Z elsewhere.
 */
export function shortcut(key, {shift = false} = {}) {
    return isApplePlatform ? `${shift ? "⇧" : ""}⌘${key}` : `Ctrl+${shift ? "Shift+" : ""}${key}`;
}
