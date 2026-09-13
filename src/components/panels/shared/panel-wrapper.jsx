/** Create each dock wrapper once, so panel state survives registry consumers re-rendering. */
function createPanelComponent(name, Component) {
  const Wrapped = (props) => (
    <div className="panel-scroll" data-panel-id={name}>
      <Component {...props} />
    </div>
  );
  Wrapped.displayName = `Panel(${name})`;
  return Wrapped;
}

export { createPanelComponent };
