/**
 * @typedef {object} FigureHeaderProps
 * @property {string} title
 * @property {string} caption What the figure shows or how to use it, set small and muted.
 */

/**
 * A figure's title bar. It sits outside the canvas, so no axis letter drawn inside can meet it.
 *
 * @param {FigureHeaderProps} props
 */
function FigureHeader({ title, caption }) {
  return (
    <header className="bloch-figure-header">
      <h4>{title}</h4>
      <span className="bloch-figure-axis">{caption}</span>
    </header>
  );
}

export { FigureHeader };
