import {
  BracketsIcon,
  ChartColumnIcon,
  DownloadIcon,
  GitCommitHorizontalIcon,
  GlobeIcon,
  OrbitIcon,
  ShapesIcon,
  SigmaIcon,
  SlidersHorizontalIcon,
  SquareFunctionIcon,
  WandSparklesIcon,
} from "lucide-react";

import {TapePanel} from "./tape/tape-panel.jsx";
import { AlgebraPanel } from "./algebra/algebra-panel.jsx";
import { BlochPanel } from "./bloch/bloch-panel.jsx";
import { CircuitPanel } from "./circuit/circuit-panel.jsx";
import { ExportPanel } from "./export/export-panel.jsx";
import { ForgePanel } from "./forge/forge-panel.jsx";
import { GatesPanel } from "./gates/gates-panel.jsx";
import { GateParamPanel } from "./gate-param/gate-param-panel.jsx";
import { ProbabilitiesPanel } from "./probabilities/probabilities-panel.jsx";
import { QubitsPanel } from "./qubits/qubits-panel.jsx";
import { RegistersPanel } from "./registers/registers-panel.jsx";
import { StatePanel } from "./state/state-panel.jsx";
import { createPanelComponent } from "./shared/panel-wrapper.jsx";

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
 * `side` places a permanent panel other than the circuit when the dock adds it: beside the circuit
 * in that direction, at that width - or, on a narrow screen, where a column beside the circuit
 * would squeeze it, as a tab behind the circuit, which stays in front.
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
 * `icon` is the panel's mark, drawn on its tab and on the toolbar button that opens it, so a panel
 * is named the same way wherever it appears and neither place picks an icon of its own.
 *
 * @type {!Object.<!string, !{title: !string, icon: !function, component: !function,
 *     permanent: (undefined|!boolean), side: (undefined|!{direction: !string, width: !int}),
 *     floating: (undefined|!{width: !int, height: !int})}>}
 */
const PANELS = {
  tape: {title: "Tape", icon: DownloadIcon, component: TapePanel},
  circuit: {
    title: "Circuit",
    icon: GitCommitHorizontalIcon,
    component: CircuitPanel,
    permanent: true,
  },
  // After the circuit: it is placed against it.
  gates: {
    title: "Gates",
    icon: ShapesIcon,
    component: GatesPanel,
    permanent: true,
    side: { direction: "left", width: 240 },
  },
  state: { title: "State", icon: SigmaIcon, component: StatePanel },
  algebra: { title: "Algebra", icon: SquareFunctionIcon, component: AlgebraPanel },
  probabilities: {
    title: "Probabilities",
    icon: ChartColumnIcon,
    component: ProbabilitiesPanel,
  },
  qubits: { title: "Qubits", icon: OrbitIcon, component: QubitsPanel },
  registers: { title: "Registers", icon: BracketsIcon, component: RegistersPanel },
  export: { title: "Export", icon: DownloadIcon, component: ExportPanel },
  forge: { title: "Make Gate", icon: WandSparklesIcon, component: ForgePanel },
  "gate-param": {
    title: "Gate Parameter",
    icon: SlidersHorizontalIcon,
    component: GateParamPanel,
    floating: { width: 420, height: 320 },
  },
  bloch: {
    title: "Bloch Sphere",
    icon: GlobeIcon,
    component: BlochPanel,
    floating: { width: 1180, height: 880 },
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
  Object.entries(PANELS).map(([name, panel]) => [name, createPanelComponent(name, panel.component)]),
);

export { PANELS, PANEL_COMPONENTS };
