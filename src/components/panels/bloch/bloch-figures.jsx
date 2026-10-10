import { Button } from "../../ui/button.jsx";
import { BlochFigure } from "./bloch-figure.jsx";

/**
 * @typedef {import("react").RefObject<HTMLCanvasElement | null>} CanvasRef
 * @typedef {(event: import("react").PointerEvent<HTMLCanvasElement>) => void} PointerHandler
 *
 * @typedef {object} BlochFiguresProps
 * @property {import("react").ReactNode=} children State controls beside or directly below the sphere.
 * @property {import("react").ReactNode=} displayControls Layers and axes below the projections.
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
 * screen reader nothing, so each describes the state and whether its direction exists.
 * @param {import("./analyzerModel.js").PanelReadout | null | undefined} readout
 */
function descriptions(readout) {
  if (readout === null || readout === undefined) {
    return {
      sphere: "Bloch sphere: no state to show",
      meridian: "Meridian: no state",
      equator: "Equator: no state",
    };
  }
  const length = `|r| ${readout.length}`;
  const controls = "Arrow keys turn it; Home turns it back.";
  if (readout.rule === "mixed") {
    return {
      sphere: `Bloch sphere: maximally mixed state, ${length}; no Bloch direction or angles defined. ${controls}`,
      meridian: `Meridian: maximally mixed state, ${length}; no Bloch direction or θ defined`,
      equator:
        "Equator, the plane of x and y: maximally mixed state; no Bloch direction or ϕ defined",
    };
  }
  if (readout.rule === "polar") {
    return {
      sphere:
        `Bloch sphere: the arrow lies on the z axis at θ ${readout.theta}, ${length}; ` +
        `ϕ is undefined on the z axis. ${controls}`,
      meridian:
        `Meridian, a plane through z: θ ${readout.theta} from |0⟩, ${length}; ` +
        "no unique meridian because ϕ is undefined on the z axis",
      equator:
        "Equator, the plane of x and y: the arrow projects to the center; ϕ is undefined on the z axis",
    };
  }
  return {
    sphere: `Bloch sphere: the arrow at θ ${readout.theta}, ϕ ${readout.phi}, ${length}. ${controls}`,
    meridian: `Meridian, the plane through z and the arrow: θ ${readout.theta} from |0⟩, ${length}`,
    equator: `Equator, the plane of x and y: ϕ ${readout.phi} from |+⟩`,
  };
}

/**
 * The analyzer's main sphere and its supporting meridian and equator projections. Their painters
 * draw into the canvases; this only lays them out and describes the state they show.
 *
 * @param {BlochFiguresProps} props
 */
function BlochFigures({
  children,
  displayControls,
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
        className="bloch-figure-sphere"
        title="Sphere"
        caption="drag to turn"
        action={
          rotated ? (
            <Button
              id="bloch-reset-view"
              size="default"
              className="bloch-reset-view"
              onClick={onResetView}
            >
              Reset view
            </Button>
          ) : undefined
        }
      >
        <canvas
          id="bloch-canvas"
          ref={sphereRef}
          className="bloch-canvas drag-canvas"
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
      {children}
      <div className="bloch-projections">
        <BlochFigure
          className="bloch-figure-projection"
          title="Meridian"
          caption="through z · θ"
        >
          <canvas
            id="bloch-meridian-canvas"
            ref={meridianRef}
            className="bloch-projection-canvas"
            role="img"
            aria-label={said.meridian}
          />
        </BlochFigure>
        <BlochFigure
          className="bloch-figure-projection"
          title="Equator"
          caption="x and y · ϕ"
        >
          <canvas
            id="bloch-equator-canvas"
            ref={equatorRef}
            className="bloch-projection-canvas"
            role="img"
            aria-label={said.equator}
          />
        </BlochFigure>
        {displayControls}
      </div>
    </div>
  );
}

export { BlochFigures };
