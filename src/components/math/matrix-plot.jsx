import { useEffect, useRef } from "react";
import * as Plot from "@observablehq/plot";

import { phaseColor } from "../../config/CanvasTheme.js";
import { modelCells } from "./matrixModel.js";

/**
 * A matrix too large to read entry by entry, plotted: one cell per entry, hue for phase and
 * opacity for magnitude - the circuit's own convention, so the plot and the canvas agree.
 *
 * Observable Plot draws it, which is what buys the axes, the tick labels and the layout that a
 * hand-rolled grid would otherwise need. The mark is `cell`, which is exactly a matrix.
 *
 * @param {!{model: !MatrixModel, size: (undefined|!int), label: (undefined|!string)}} props
 */
function MatrixPlot({ model, size = 260, label }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return undefined;
    }

    const cells = modelCells(model).map(({ row, col, value }) => {
      const magnitude = Math.hypot(value.real, value.imag);
      return {
        row: model.rowLabel(row),
        col: model.colLabel(col),
        rowIndex: row,
        colIndex: col,
        magnitude,
        // Phase is meaningless where there is no amplitude, so those cells stay bare.
        color:
          magnitude < 1e-9
            ? "transparent"
            : phaseColor((Math.atan2(value.imag, value.real) * 180) / Math.PI),
        title: `${model.rowLabel(row)} ← ${model.colLabel(col)}\n|a| ${magnitude.toFixed(3)}`,
      };
    });

    // Labels are only readable while there are few of them; past that the grid speaks for itself.
    const labelled = model.rows <= 8;
    const plot = Plot.plot({
      width: size,
      height: size,
      marginLeft: labelled ? 54 : 8,
      marginTop: labelled ? 22 : 8,
      marginRight: 8,
      marginBottom: 8,
      style: { background: "transparent", color: "var(--muted-foreground)", fontSize: "10px" },
      x: {
        axis: labelled ? "top" : null,
        domain: cells.map((cell) => cell.col),
        label: null,
        tickSize: 0,
      },
      y: {
        axis: labelled ? "left" : null,
        domain: cells.map((cell) => cell.row),
        label: null,
        tickSize: 0,
      },
      color: { type: "identity" },
      marks: [
        Plot.cell(cells, {
          x: "col",
          y: "row",
          fill: "color",
          fillOpacity: (d) => Math.min(1, 0.15 + d.magnitude),
          inset: 0.5,
          title: "title",
        }),
      ],
    });

    host.replaceChildren(plot);
    return () => plot.remove();
  }, [model, size]);

  return (
    <div
      className="matrix-plot"
      ref={hostRef}
      role="img"
      aria-label={
        label ??
        `The matrix plotted as ${model.rows} by ${model.cols} cells, hue for phase and opacity for magnitude`
      }
    />
  );
}

export { MatrixPlot };
