import { FigureHeader } from "./figure-header.jsx";

/**
 * @typedef {object} BlochFigureProps
 * @property {string} title
 * @property {string=} className
 * @property {string} caption
 * @property {import("react").ReactNode=} action A control in the title bar, in the caption's place.
 * @property {import("react").ReactNode} children The figure's canvas.
 */

/**
 * One of the analyzer's figures: a title bar over its canvas.
 *
 * @param {BlochFigureProps} props
 */
function BlochFigure({ title, caption, action, children, className }) {
  return (
    <figure className={["bloch-figure", className].filter(Boolean).join(" ")}>
      <FigureHeader title={title} caption={caption} action={action} />
      {children}
    </figure>
  );
}

export { BlochFigure };
