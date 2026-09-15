import { useMemo } from "react";
import { CircuitDefinition } from "../../circuit/model/CircuitDefinition.js";
import { GateColumn } from "../../circuit/model/GateColumn.js";
import { CircuitFigure } from "./circuit-figure.jsx";

/** Use the actual gate renderer, including unnamed matrix and nested-circuit gates. */
export function GatePreview({ gate }) {
  const circuit = useMemo(
    () =>
      new CircuitDefinition(gate.height, [
        new GateColumn(
          Array.from({ length: gate.height }, (_, row) =>
            row === 0 ? gate : undefined,
          ),
        ),
      ]),
    [gate],
  );
  return (
    <section className="gate-construction-preview">
      <h3>Circuit appearance</h3>
      <CircuitFigure circuit={circuit} time={0} responsive />
    </section>
  );
}
