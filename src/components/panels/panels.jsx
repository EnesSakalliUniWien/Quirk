import { BlochPanel } from "./bloch-panel.jsx";
import { CircuitPanel } from "./circuit-panel.jsx";
import { ExportPanel } from "./export-panel.jsx";
import { ForgePanel } from "./forge-panel.jsx";
import { GateParamPanel } from "./gate-param-panel.jsx";
import { MenuPanel } from "./menu-panel.jsx";
import { StatePanel } from "./state-panel.jsx";

/**
 * Every panel the dock can show, keyed by the name dockview writes into its serialized layout.
 *
 * This map is the whole registration surface: a new panel is one entry here plus its component,
 * and `openPanel` in src/components/dock.jsx can then put it on screen by that name. Nothing else
 * in the shell needs to know it exists.
 *
 * `permanent` panels are the app rather than a view of it, so the dock re-adds one if a layout
 * ever comes back without it, and the dock keeps their content mounted even while another tab in
 * their group is showing. The circuit needs that: a hidden panel is destroyed by default, and
 * rebuilding the circuit would mean a second startQuirk and a lost WebGL context.
 *
 * `floating` panels are answers to a moment - a greeting, a clicked gate, a clicked sphere - and
 * open as windows over the circuit at the size given here. The rest dock beside it, where they can
 * stay. A floating window has no natural size, so leaving the size out gives a zero-sized sliver.
 *
 * An open panel never makes the app busy. The floating dialogs this replaced disabled undo, redo,
 * clearing, the transport and half the chrome while one was up, because a dialog could be left
 * holding a circuit that had changed underneath it. Panels dock and stay open - the state panel is
 * meant to be read *while* the circuit plays - so that rule would leave the app permanently
 * disabled. A panel that depends on something in the circuit checks that it is still there instead:
 * the parameter panel refuses to apply to a slot whose gate changed, and the Bloch panel closes
 * when its sphere goes. A new panel owes the same, and owes it to itself; nothing will disable the
 * app on its behalf.
 *
 * @type {!Object.<!string, !{title: !string, component: !function, permanent: (undefined|!boolean),
 *     floating: (undefined|!{width: !int, height: !int})}>}
 */
const PANELS = {
  circuit: { title: "Circuit", component: CircuitPanel, permanent: true },
  state: { title: "State", component: StatePanel },
  export: { title: "Export", component: ExportPanel },
  forge: { title: "Make Gate", component: ForgePanel },
  menu: {
    title: "Welcome",
    component: MenuPanel,
    floating: { width: 880, height: 560 },
  },
  "gate-param": {
    title: "Gate Parameter",
    component: GateParamPanel,
    floating: { width: 420, height: 320 },
  },
  bloch: {
    title: "Bloch Sphere",
    component: BlochPanel,
    floating: { width: 420, height: 680 },
  },
};

/**
 * The name -> component record dockview itself wants, with every panel wrapped in the one element
 * that says which panel it is and gives it its own scrollbar.
 *
 * `data-panel-id` is the single way to find a panel from outside: the registry stamps it, so it
 * cannot drift from the name the dock opens the panel by, and no panel needs an id of its own.
 */
const PANEL_COMPONENTS = Object.fromEntries(
  Object.entries(PANELS).map(([name, panel]) => {
    const Component = panel.component;
    const Wrapped = (props) => (
      <div className="panel-scroll" data-panel-id={name}>
        <Component {...props} />
      </div>
    );
    Wrapped.displayName = `Panel(${name})`;
    return [name, Wrapped];
  }),
);

export { PANELS, PANEL_COMPONENTS };
