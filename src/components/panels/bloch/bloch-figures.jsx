import { BlochFigure } from "./bloch-figure.jsx";

/**
 * @typedef {import("react").RefObject<HTMLCanvasElement | null>} CanvasRef
 * @typedef {(event: import("react").PointerEvent<HTMLCanvasElement>) => void} PointerHandler
 *
 * @typedef {object} BlochFiguresProps
 * @property {CanvasRef} sphereRef
 * @property {CanvasRef} meridianRef
 * @property {CanvasRef} equatorRef
 * @property {PointerHandler} onPointerDown Starts a drag that rotates the sphere.
 * @property {PointerHandler} onPointerMove Rotates the sphere while a drag holds it.
 */

/**
 * The analyzer's three figures in equal columns: the sphere in perspective, the meridian that holds
 * θ and the equator that holds ϕ. Being equally wide, they draw one unit circle, at one size and one
 * height. Their painters draw into the canvases; this only lays them out.
 *
 * @param {BlochFiguresProps} props
 */
function BlochFigures({
  sphereRef,
  meridianRef,
  equatorRef,
  onPointerDown,
  onPointerMove,
}) {
  return (
    <div className="bloch-figures">
      <BlochFigure title="Sphere" caption="drag to rotate">
        <canvas
          id="bloch-canvas"
          ref={sphereRef}
          className="bloch-canvas"
          width="320"
          height="320"
          aria-label="Enlarged Bloch sphere view"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        />
      </BlochFigure>
      <BlochFigure title="Meridian" caption="XZ turned by ϕ · θ">
        <canvas
          id="bloch-meridian-canvas"
          ref={meridianRef}
          className="bloch-projection-canvas"
          aria-label="The meridian through the state, where θ is measured"
        />
      </BlochFigure>
      <BlochFigure title="Equator" caption="XY · ϕ">
        <canvas
          id="bloch-equator-canvas"
          ref={equatorRef}
          className="bloch-projection-canvas"
          aria-label="The equator, where ϕ is measured"
        />
      </BlochFigure>
    </div>
  );
}

export { BlochFigures };
