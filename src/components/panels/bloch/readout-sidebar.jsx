import { AnalyzerGroup } from "./analyzer-group.jsx";
import { AXES } from "./analyzerModel.js";
import { ReadoutRow } from "./readout-row.jsx";
import { ReadoutSection } from "./readout-section.jsx";

/**
 * @typedef {object} ReadoutSidebarProps
 * @property {import("./analyzerModel.js").PanelReadout | null | undefined} readout What to print;
 *     null or undefined while there is no state, when every value reads n/a.
 */

const UNAVAILABLE = "n/a";

/**
 * The readout beside the figures, in two groups by what they describe: the Bloch vector - its
 * length and angles, its Cartesian components and the quaternion that turns |0⟩ onto it - and the
 * quantum state - its amplitudes, its purity and its ket. Each value sits in one right-aligned
 * column so they scan down.
 *
 * @param {ReadoutSidebarProps} props
 */
function ReadoutSidebar({ readout }) {
  const shown = readout ?? undefined;
  /** @param {keyof import("./analyzerModel.js").PanelReadout} field */
  const value = (field) =>
    shown === undefined ? UNAVAILABLE : String(shown[field]);
  /** @type {Array<{ axis: string, formula: (string | undefined), value: string }>} */
  const components =
    shown?.components ??
    AXES.map(([axis]) => ({ axis, formula: undefined, value: UNAVAILABLE }));
  /** @type {Array<{ name: string, formula: (string | undefined), value: string }>} */
  const amplitudes = shown?.amplitudes ?? [
    { name: "α", formula: undefined, value: UNAVAILABLE },
    { name: "β", formula: undefined, value: UNAVAILABLE },
  ];

  return (
    <aside className="bloch-sidebar" aria-label="Readout">
      <AnalyzerGroup title="Bloch vector" purpose="where the state points">
        <ReadoutSection title="State vector">
          <dl className="bloch-readout">
            <ReadoutRow
              symbol="|r|"
              id="bloch-purity"
              value={value("length")}
            />
            <ReadoutRow
              symbol="θ"
              id="bloch-theta"
              value={value("theta")}
              title={shown?.thetaExact}
            />
            <ReadoutRow
              symbol="ϕ"
              id="bloch-phi"
              value={value("phi")}
              title={shown?.phiExact}
            />
          </dl>
          {shown?.note !== undefined && (
            <p id="bloch-note" className="bloch-note">
              {shown.note}
            </p>
          )}
        </ReadoutSection>

        <ReadoutSection title="Cartesian components">
          <dl className="bloch-readout">
            {components.map(({ axis, formula, value: component }) => (
              <ReadoutRow
                key={axis}
                symbol={axis}
                symbolClass={`bloch-axis-${axis}`}
                formula={formula}
                id={`bloch-${axis}`}
                value={component}
              />
            ))}
          </dl>
        </ReadoutSection>

        <ReadoutSection title="Quaternion">
          <dl className="bloch-readout bloch-readout-wide">
            <ReadoutRow
              symbol="q"
              id="bloch-quaternion"
              value={value("quaternion")}
              withFormula={false}
            />
            <ReadoutRow
              symbol="r"
              id="bloch-vector-quaternion"
              value={value("vector")}
              withFormula={false}
            />
          </dl>
          <p className="bloch-hint">
            q = cos(θ/2) + sin(θ/2)(−sin ϕ i + cos ϕ j) turns |0⟩ onto the
            state; r = |r| q k q̄.
          </p>
        </ReadoutSection>
      </AnalyzerGroup>

      <AnalyzerGroup title="Quantum state" purpose="what the qubit holds">
        <ReadoutSection title="Quantum amplitudes">
          <dl className="bloch-readout">
            {amplitudes.map(({ name, formula, value: amplitude }) => (
              <ReadoutRow
                key={name}
                symbol={name}
                formula={formula}
                id={name === "α" ? "bloch-alpha" : "bloch-beta"}
                value={amplitude}
              />
            ))}
          </dl>
        </ReadoutSection>

        <ReadoutSection title="Purity">
          <dl className="bloch-readout">
            <ReadoutRow
              symbol="Tr ρ²"
              formula="(1 + |r|²)/2"
              id="bloch-tr-rho2"
              value={value("purity")}
            />
          </dl>
        </ReadoutSection>

        <ReadoutSection title="State">
          <p id="bloch-state" className="bloch-state">
            {value("state")}
          </p>
        </ReadoutSection>
      </AnalyzerGroup>
    </aside>
  );
}

export { ReadoutSidebar };
