import { LucideProvider } from "lucide-react";

import { ICON_STROKE_WIDTH } from "../../resources/icons/index.js";

/**
 * One stroke for every icon in the app, the way the OP-1's panel draws every key with the same
 * line. lucide-react takes its defaults from this context, so a call site names the icon and
 * nothing else, and an icon that needs another weight is the one that says so.
 */
function IconProvider({ children }) {
  return (
    <LucideProvider strokeWidth={ICON_STROKE_WIDTH}>{children}</LucideProvider>
  );
}

export { IconProvider };
