import { FigureHeader } from "./figure-header.jsx";

/**
 * @typedef {object} BlochFigureProps
 * @property {string} title
 * @property {string} caption
 * @property {import("react").ReactNode} children The figure's canvas.
 */

/**
 * One of the analyzer's figures: a title bar over its canvas.
 *
 * @param {BlochFigureProps} props
 */
function BlochFigure({ title, caption, children }) {
  return (
    <figure className="bloch-figure">
      <FigureHeader title={title} caption={caption} />
      {children}
    </figure>
  );
}

export { BlochFigure };
