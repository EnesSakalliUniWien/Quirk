import { useEffect, useRef, useState } from "react";
import { Layout } from "../../../config/Layout.js";
import { appStore } from "../../../state/appStore.js";

/**
 * A text box over the register's name. Enter or leaving applies; Escape lets it be. A name the
 * registers refuse - taken, or not a name - is said under the box and the box stays.
 */
function RenameBox({ rename, zoom, actions }) {
  const inputRef = useRef(null);
  // Set once the box is closing, so a blur fired by its removal cannot apply what Escape gave up.
  const closing = useRef(false);
  const [error, setError] = useState(undefined);
  const { rect } = rename;
  const done = () => {
    closing.current = true;
    appStore.setState({ registerRename: undefined });
  };
  const apply = () => {
    const input = inputRef.current;
    if (input === null || closing.current) {
      return;
    }
    const refused = actions.rename(rename.name, input.value.trim());
    if (refused === undefined) {
      done();
    } else {
      setError(refused);
      input.focus();
    }
  };
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const style = {
    left: `${rect.x * zoom}px`,
    top: `${rect.y * zoom}px`,
    width: `${Math.max(rect.w, Layout.REGISTER_NAME_WIDTH * 2) * zoom}px`,
    height: `${Layout.REGISTER_HEIGHT * zoom}px`,
    fontSize: `${Layout.REGISTER_FONT_SIZE * zoom}px`,
  };
  return (
    <>
      <input
        ref={inputRef}
        className="gutter-rename"
        style={style}
        defaultValue={rename.name}
        aria-label={`Rename register ${rename.name}`}
        aria-invalid={error !== undefined}
        autoComplete="off"
        spellCheck="false"
        onChange={() => setError(undefined)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            apply();
            event.preventDefault();
          } else if (event.key === "Escape") {
            done();
            event.preventDefault();
          }
          event.stopPropagation();
        }}
        onBlur={apply}
      />
      {error !== undefined && (
        <p className="gutter-rename-error" role="alert" style={{ left: style.left, top: `${(rect.y + Layout.REGISTER_HEIGHT) * zoom}px` }}>
          {error}
        </p>
      )}
    </>
  );
}

export { RenameBox };
