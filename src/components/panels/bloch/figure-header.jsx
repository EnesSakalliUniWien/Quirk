/**
 * @typedef {object} FigureHeaderProps
 * @property {string} title
 * @property {string} caption What the figure shows or how to use it, set small and muted.
 * @property {import("react").ReactNode=} action A control that takes the caption's place.
 */

/**
 * A figure's title bar. It sits outside the canvas, so no axis letter drawn inside can meet it.
 * A figure is a part of the analyzer of its own, so its title is a level below the analyzer's.
 *
 * @param {FigureHeaderProps} props
 */
function FigureHeader({ title, caption, action }) {
  return (
    <header className="bloch-figure-header">
      <h3>{title}</h3>
      {action ?? <span className="bloch-figure-axis">{caption}</span>}
    </header>
  );
}

export { FigureHeader };
