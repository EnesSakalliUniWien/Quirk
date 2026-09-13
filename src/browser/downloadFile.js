/** Starts a browser download; the caller owns content encoding, filename and MIME type. */
function downloadFile(text, filename, type = "application/json") {
    const url = URL.createObjectURL(new Blob([text], {type}));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export {downloadFile};
