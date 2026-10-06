import { useRef, useState } from "react";
import { notify } from "../../ui/toasts.jsx";

/** Generate before awaiting the clipboard, so the click keeps its intended data. */
async function copyToClipboard(text, title, fallback) {
  let value;
  try {
    value = text();
  } catch (error) {
    notify(
      `Could not generate ${title}`,
      `${error instanceof Error ? error.message : String(error)} ${fallback}`,
    );
    return;
  }
  if (!navigator.clipboard?.writeText) {
    notify(
      `Could not copy ${title}`,
      `Clipboard is unavailable in this browser context. ${fallback}`,
    );
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    notify(`${title} copied`);
  } catch (error) {
    notify(
      `Could not copy ${title}`,
      `${error instanceof Error && error.name === "NotAllowedError" ? "The browser did not allow the clipboard write." : "The clipboard write failed."} ${fallback}`,
    );
  }
}

function CopyButton({
  id = /** @type {string | undefined} */ (undefined),
  resultId = /** @type {string | undefined} */ (undefined),
  label,
  text,
  title = label,
  fallback = "Select and copy the output below, or retry.",
}) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const copy = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await copyToClipboard(text, title, fallback);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <div className="panel-action-row">
      <button id={id} type="button" disabled={pending} onClick={copy}>
        {label}
      </button>
      <span id={resultId} className="copy-result">
        {pending ? "Copying…" : ""}
      </span>
    </div>
  );
}

export { CopyButton };
