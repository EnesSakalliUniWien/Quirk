/**
 * A row of buttons that share their inner edges. Styled by src/styles/ui/buttons.css.
 */
function ButtonGroup({ className, ...props }) {
  return (
    <div
      role="group"
      data-slot="button-group"
      className={["ui-button-group", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export { ButtonGroup };
