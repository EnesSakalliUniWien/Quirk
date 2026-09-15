import { Button as ButtonPrimitive } from "@base-ui/react/button";

/**
 * The chrome's button: Base UI's primitive with the app's own styling from
 * src/styles/controls.css. `size` is "default" (text with an optional inline icon) or "icon"
 * (a 2rem square); the ghost look is the only one the app uses.
 */
/**
 * @param {{ className?: string, size?: ("default" | "icon") } &
 *     Record<string, any>} props Any other prop is passed to Base UI's button.
 */
function Button({ className, size = "default", ...props }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-size={size}
      className={["ui-button", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export { Button };
