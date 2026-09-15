import { takeJson } from "./json.js";
import { LINK_LIMIT } from "./limits.js";

function takeLink(take, base) {
  const fragment = `#take=${encodeURIComponent(takeJson(take))}`;
  // encodeURIComponent produces ASCII, so character length equals UTF-8 byte length here.
  if (fragment.length > LINK_LIMIT) {
    throw new Error("Take exceeds the 32 KiB link limit. Download JSON instead.");
  }
  // Preserve the caller's base string and the existing fragment format.
  return base.split("#", 1)[0] + fragment;
}

export { takeLink };
