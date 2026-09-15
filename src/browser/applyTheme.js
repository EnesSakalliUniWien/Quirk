import { Theme } from "../config/Theme.js";

/**
 * Assign the JavaScript theme before React mounts, including body-level popovers and floating
 * panels. CSS only consumes these properties; no theme stylesheet or stock theme is applied.
 * The document argument lets isolated browser tests use the same startup path.
 */
function applyTheme(targetDocument = document) {
  const root = targetDocument.documentElement;
  for (const [name, value] of Object.entries({
    ...Theme.dom,
    ...Theme.dockProperties,
  })) {
    root.style.setProperty(name, value);
  }
  root.style.colorScheme = Theme.colorScheme;
  root.classList.toggle("dark", Theme.colorScheme === "dark");
  for (const [name, content] of [
    ["color-scheme", Theme.colorScheme],
    ["theme-color", Theme.dom["--background"]],
  ]) {
    let meta = targetDocument.querySelector(`meta[name="${name}"]`);
    if (meta === null) {
      meta = targetDocument.createElement("meta");
      meta.name = name;
      targetDocument.head.append(meta);
    }
    meta.content = content;
  }
}

export { applyTheme };
