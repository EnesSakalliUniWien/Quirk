import { useStore } from "zustand";

import { EXAMPLE_CIRCUITS } from "../../config/exampleCircuits.js";
import { appStore } from "../../state/appStore.js";
import { closePanel } from "../dock.jsx";

/** Where to read about the app. Kept beside the panel that shows them, as data. */
const RESOURCES = [
  {
    label: "How to Use",
    href: "https://github.com/EnesSakalliUniWien/Quirk/wiki/How-to-use-Quirk",
    path: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
  },
  {
    label: "Tutorial Video",
    href: "https://www.youtube.com/watch?v=aloFwlBUwsQ",
    path: (
      <>
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
        <path d="m10 15 5-3-5-3z" />
      </>
    ),
  },
  {
    label: "Source Code",
    href: "https://github.com/EnesSakalliUniWien/Quirk",
    path: (
      <>
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
        <path d="M9 18c-4.51 2-5-2-7-2" />
      </>
    ),
  },
];

/** The gestures the circuit answers to, listed for someone meeting it for the first time. */
const SHORTCUTS = [
  [<kbd key="k">Ctrl/⌘</kbd>, <kbd key="z">Z</kbd>, "Undo"],
  [<kbd key="k">Ctrl/⌘</kbd>, <kbd key="y">Y</kbd>, "Redo"],
  [<kbd key="k">Space</kbd>, undefined, "Play or pause the animation"],
  [<kbd key="k">Shift</kbd>, "+drag", "Copy a gate"],
  [<kbd key="k">Ctrl/⌘</kbd>, "+drag", "Grab a whole column"],
  [<kbd key="k">Alt</kbd>, "+drag", "Grab a gate's inverse"],
  ["Middle-click", undefined, "Delete a gate"],
  [
    <>
      <kbd key="u">↑</kbd> <kbd key="d">↓</kbd>
    </>,
    undefined,
    "Step through toolbox gates",
  ],
  ["Drag down the wire labels", undefined, "Group wires into a register"],
  ["Right-click a wire label", undefined, "Group, rename, feed or ungroup a register"],
  ["Double-click a register", undefined, "Rename it in place"],
];

/**
 * The welcome panel: what the app is, where to read about it, circuits worth opening, and the
 * gestures the circuit answers to.
 */
function MenuPanel() {
  const deps = useStore(appStore, (s) => s.panelDeps);

  const openExample = (event, circuit) => {
    // Let the browser handle modified and non-left clicks, so opening the link in a new tab
    // still works.
    if (
      event.shiftKey ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    deps?.revision.commit(JSON.stringify(circuit));
    closePanel("menu");
  };

  return (
    <>
      <div className="panel-content">
        <div className="panel-body welcome-panel">
          <h1 className="welcome-title">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="1" />
              <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" />
              <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" />
            </svg>
            Welcome to Shadow-Quant
          </h1>
          <div className="welcome-version">v2.3</div>
          <div className="welcome-tagline">
            A drag-and-drop quantum circuit simulator.
          </div>

          <div className="welcome-primary">
            <button
              type="button"
              id="close-menu-button"
              className="welcome-primary-action"
              onClick={() => closePanel("menu")}
            >
              Edit Circuit
            </button>
          </div>

          <nav className="resource-grid" aria-label="Shadow-Quant resources">
            {RESOURCES.map((resource) => (
              <a key={resource.label} className="resource-card" href={resource.href}>
                <div className="resource-card-content">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {resource.path}
                  </svg>
                  <div>{resource.label}</div>
                </div>
              </a>
            ))}
          </nav>
        </div>

        <aside className="example-panel">
          <h2 className="example-heading">Example Circuits</h2>
          <nav className="example-links" aria-label="Example circuits">
            {EXAMPLE_CIRCUITS.map(({ name, circuit }) => (
              <a
                key={name}
                href={"#circuit=" + encodeURIComponent(JSON.stringify(circuit))}
                onClick={(event) => openExample(event, circuit)}
              >
                {name}
              </a>
            ))}
          </nav>

          <h2 className="example-heading shortcut-heading">Shortcuts</h2>
          <dl className="shortcut-list" aria-label="Keyboard and mouse shortcuts">
            {SHORTCUTS.map(([first, second, meaning]) => (
              <div key={meaning} style={{ display: "contents" }}>
                <dt>
                  {first}
                  {second}
                </dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </>
  );
}

export { MenuPanel };
