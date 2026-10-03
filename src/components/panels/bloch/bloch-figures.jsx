import { Button } from "../../ui/button.jsx";
import { BlochFigure } from "./bloch-figure.jsx";

/**
 * @typedef {import("react").RefObject<HTMLCanvasElement | null>} CanvasRef
 * @typedef {(event: import("react").PointerEvent<HTMLCanvasElement>) => void} PointerHandler
 *
 * @typedef {object} BlochFiguresProps
 * @property {CanvasRef} sphereRef
 * @property {CanvasRef} meridianRef
 * @property {CanvasRef} equatorRef
 * @property {import("./analyzerModel.js").PanelReadout | null | undefined} readout What the
 *     figures show, which each canvas also says in words.
 * @property {boolean} rotated Whether the sphere has been turned from its default view.
 * @property {() => void} onResetView Turns the sphere back to its default view.
 * @property {PointerHandler} onPointerDown Starts a drag that rotates the sphere.
 * @property {PointerHandler} onPointerMove Rotates the sphere while a drag holds it.
 * @property {(event: import("react").KeyboardEvent<HTMLCanvasElement>) => void} onKeyDown Arrow
 *     keys turn the sphere; Home turns it back.
 */

/**
 * What each figure shows, in words, for the canvases' accessible names: a picture alone tells a
 * screen reader nothing, so each says where the arrow points in it.
 * @param {import("./analyzerModel.js").PanelReadout | null | undefined} readout
 */
function descriptions(readout) {
  if (readout === null || readout === undefined) {
    return { sphere: "Bloch sphere: no state to show", meridian: "Meridian: no state", equator: "Equator: no state" };
  }
  const length = `|r| ${readout.length}`;
  return {
    sphere: `Bloch sphere, seen from above: the arrow at θ ${readout.theta}, ϕ ${readout.phi}, ${length}. ` +
      "Arrow keys turn it; Home turns it back.",
    meridian: `Meridian, the plane through z and the arrow: θ ${readout.theta} from |0⟩, ${length}`,
    equator: `Equator, the plane of x and y: ϕ ${readout.phi} from |+⟩`,
  };
}

/**
 * The analyzer's three figures in equal columns: the sphere seen from above, the meridian that
 * holds θ and the equator that holds ϕ. Being equally wide, they draw one unit circle, at one size
 * and one height. Their painters draw into the canvases; this only lays them out.
 *
 * @param {BlochFiguresProps} props
 */
function BlochFigures({
  sphereRef,
  meridianRef,
  equatorRef,
  readout,
  rotated,
  onResetView,
  onPointerDown,
  onPointerMove,
  onKeyDown,
}) {
  const said = descriptions(readout);
  return (
    <div className="bloch-figures">
      <BlochFigure
        title="Sphere"
        caption="drag to turn"
        action={rotated ? (
          <Button id="bloch-reset-view" size="default" className="bloch-reset-view" onClick={onResetView}>
            Reset view
          </Button>
        ) : undefined}
      >
        <canvas
          id="bloch-canvas"
          ref={sphereRef}
          className="bloch-canvas"
          width="320"
          height="320"
          role="img"
          tabIndex={0}
          aria-label={said.sphere}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onKeyDown={onKeyDown}
        />
      </BlochFigure>
      <BlochFigure title="Meridian" caption="through z · θ">
        <canvas
          id="bloch-meridian-canvas"
          ref={meridianRef}
          className="bloch-projection-canvas"
          role="img"
          aria-label={said.meridian}
        />
      </BlochFigure>
      <BlochFigure title="Equator" caption="x and y · ϕ">
        <canvas
          id="bloch-equator-canvas"
          ref={equatorRef}
          className="bloch-projection-canvas"
          role="img"
          aria-label={said.equator}
        />
      </BlochFigure>
    </div>
  );
}

export { BlochFigures };
