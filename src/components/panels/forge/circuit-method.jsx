import { useEffect, useRef, useState } from "react";
import { CanvasTheme } from "../../../config/CanvasTheme.js";
import { Point } from "../../../geometry/Point.js";
import { Rect } from "../../../geometry/Rect.js";
import { RenderSurface } from "../../../draw/surface/RenderSurface.js";
import { fromJsonText_CircuitDefinition } from "../../../serialization/Serializer.js";
import { drawCircuitTooltip } from "../../../editor/rendering/previews/CircuitPreview.js";
import { drawingArea } from "../../../draw/scene/DisplayView.js";
import { fitParagraph } from "../../../draw/text/TextLayout.js";
import { rectangle } from "../../../draw/shapes/ShapeView.js";
import { parseUserGateFromCircuitRange } from "../../../serialization/customGateParsing.js";
import { useDebounced, PREVIEW_DEBOUNCE_MILLIS } from "./useDebounced.js";
import { inputKey, entered } from "./inputs.js";

/**
 * The third method, which takes a range of the circuit on screen rather than a matrix: it previews
 * the gate the range would become, reports what it needs and what it costs, and animates while a
 * time-dependent gate is inside it.
 *
 * @param {!{deps: !Object, circuitJson: !string, onCreate: !function(!Gate, !Object): void}} props
 */
function CircuitMethod({ deps, circuitJson, onCreate }) {
  const canvasRef = useRef(null);
  const [cols, setCols] = useState("");
  const [rows, setRows] = useState("");
  const [name, setName] = useState("");
  const [stats, setStats] = useState({ inputs: "(none)", weight: "0" });
  const [buildable, setBuildable] = useState(false);
  const settled = useDebounced(
    inputKey(cols, rows, name, circuitJson),
    PREVIEW_DEBOUNCE_MILLIS,
  );
  // Held in a ref for the same reason as the matrix methods': the preview follows the settled
  // inputs, not every keystroke's new closure.
  const parseRef = useRef(undefined);
  parseRef.current = () => {
    const circuit = fromJsonText_CircuitDefinition(circuitJson);
    const gate = parseUserGateFromCircuitRange(
      circuit,
      entered(cols, "1:∞"),
      entered(rows, "1:∞"),
      name.trim(),
    );
    return { gate, circuit };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return undefined;
    }
    const paint = (gate) => {
      const painter = RenderSurface.forCanvas(canvas).beginFrame();
      rectangle(painter, drawingArea(painter), { fill: CanvasTheme.surface.gate });
      drawCircuitTooltip(
        painter,
        gate.knownCircuitNested,
        new Rect(0, 0, canvas.width, canvas.height),
        true,
        deps.cycleTime(),
      );
    };

    let gate;
    try {
      gate = parseRef.current().gate;
      const keys = gate.getUnmetContextKeys();
      setStats({
        inputs:
          keys.size === 0
            ? "(none)"
            : [...keys]
                .map((e) =>
                  e.replace("Input Range ", "").replace("Input NO_DEFAULT Range ", ""),
                )
                .join(", "),
        weight: "" + gate.knownCircuit.gateWeight(),
      });
      setBuildable(true);
      paint(gate);
    } catch (ex) {
      setStats({ inputs: "(err)", weight: "(err)" });
      setBuildable(false);
      const painter = RenderSurface.forCanvas(canvas).beginFrame();
      rectangle(painter, drawingArea(painter), { fill: CanvasTheme.surface.gate });
      fitParagraph(painter, ex + "", new Rect(0, 0, canvas.width, canvas.height), {
        alignment: new Point(0.5, 0.5),
        fill: CanvasTheme.error.text,
        maxFontSize: 24,
      });
      return undefined;
    }

    // A gate that never changes needs one frame; one that does follows the circuit's own clock.
    if (gate.stableDuration() === Infinity) {
      return undefined;
    }
    let frame = requestAnimationFrame(function tick() {
      paint(gate);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [settled, deps]);

  return (
    <section className="forge-method">
      <h2>From Circuit</h2>
      <div className="forge-fields">
        <label className="forge-field" htmlFor="gate-forge-circuit-cols">
          <span>Column range</span>
          <input
            id="gate-forge-circuit-cols"
            type="text"
            placeholder="1:∞"
            value={cols}
            onChange={(event) => setCols(event.target.value)}
          />
        </label>
        <label className="forge-field" htmlFor="gate-forge-circuit-rows">
          <span>Wire range</span>
          <input
            id="gate-forge-circuit-rows"
            type="text"
            placeholder="1:∞"
            value={rows}
            onChange={(event) => setRows(event.target.value)}
          />
        </label>
      </div>
      <div className="forge-stats">
        Inputs: <span id="gate-forge-circuit-inputs">{stats.inputs}</span>
        <br />
        Weight: <span id="gate-forge-circuit-weight">{stats.weight}</span>
      </div>
      <canvas id="gate-forge-circuit-canvas" ref={canvasRef} className="forge-preview" />
      <label className="forge-field" htmlFor="gate-forge-circuit-name">
        <span>Circuit symbol</span>
        <input
          id="gate-forge-circuit-name"
          type="text"
          placeholder="[the circuit]"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button
        id="gate-forge-circuit-button"
        type="button"
        disabled={!buildable}
        onClick={() => {
          try {
            const { gate, circuit } = parseRef.current();
            onCreate(gate, circuit);
          } catch (ex) {
            // The button is about to be disabled, so no handling required.
            console.warn(ex);
          }
        }}
      >
        Create Circuit Gate
      </button>
    </section>
  );
}

export { CircuitMethod };
