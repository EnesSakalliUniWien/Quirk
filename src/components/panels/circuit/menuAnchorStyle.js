/** Convert a menu's viewport coordinates into the circuit host's scroll content coordinates. */
function menuAnchorStyle(element, { x, y }) {
  const box =
    element === null ? { left: 0, top: 0 } : element.getBoundingClientRect();
  return {
    left: `${x - box.left + (element?.scrollLeft ?? 0)}px`,
    top: `${y - box.top + (element?.scrollTop ?? 0)}px`,
  };
}

export { menuAnchorStyle };
