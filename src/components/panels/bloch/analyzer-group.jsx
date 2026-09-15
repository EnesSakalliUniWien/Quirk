import { useId } from "react";

/**
 * @typedef {object} AnalyzerGroupProps
 * @property {string} title The group's name.
 * @property {string} purpose What the group is responsible for, set after its name, muted.
 * @property {import("react").ReactNode} children The parts that share that responsibility.
 */

/**
 * One group of the analyzer, holding the parts that share one responsibility: the figures, what
 * they draw, which state they show, or the numbers that describe it. It is the app's own panel
 * section, so it reads like the sections of the export panel.
 *
 * @param {AnalyzerGroupProps} props
 */
function AnalyzerGroup({ title, purpose, children }) {
  const titleId = useId();
  return (
    <section className="panel-section bloch-group" aria-labelledby={titleId}>
      <header className="panel-section-heading bloch-group-heading">
        <h3 id={titleId} className="panel-section-title">
          {title}
        </h3>
        <span>{purpose}</span>
      </header>
      <div className="panel-section-body">{children}</div>
    </section>
  );
}

export { AnalyzerGroup };
