import {useLayoutEffect} from "react";

/**
 * Align a sequence of matrix cards using natural typeset sizes, without shrinking their text.
 * Only the presentation is measured. Reset imposed dimensions before measuring, so values can
 * shrink as well as grow. Resizing must preserve the user's position in the operation strip.
 */
function useMatrixLayout(ref, content) {
    useLayoutEffect(() => {
        const track = ref.current;
        if (!track) return undefined;
        let active = true;
        let frame;
        const measure = () => {
            if (!active) return;
            const scroll = track.scrollLeft;
            const scale = track.getBoundingClientRect().width / track.offsetWidth || 1;
            track.style.removeProperty("--matrix-row-height");
            track.style.removeProperty("--algebra-card-width");
            const cells = [...track.querySelectorAll(".matrix-table mtd")];
            const height = Math.ceil(cells.reduce((max, cell) => Math.max(max, cell.getBoundingClientRect().height / scale), 0));
            if (height) track.style.setProperty("--matrix-row-height", `${height}px`);
            const cards = [...track.querySelectorAll(".algebra-step")];
            const width = Math.ceil(cards.reduce((max, card) => Math.max(max, card.getBoundingClientRect().width / scale), 0));
            if (width) track.style.setProperty("--algebra-card-width", `${width}px`);
            track.scrollLeft = scroll;
            track.dataset.layoutReady = "true";
        };
        const schedule = () => {cancelAnimationFrame(frame); frame = requestAnimationFrame(measure);};
        measure();
        let lastWidth = track.clientWidth;
        const observer = new ResizeObserver(() => {
            if (track.clientWidth !== lastWidth) {lastWidth = track.clientWidth; schedule();}
        });
        observer.observe(track);
        document.fonts.ready.then(() => {if (active) schedule();});
        document.fonts.addEventListener("loadingdone", schedule);
        window.addEventListener("resize", schedule);
        return () => {
            active = false;
            cancelAnimationFrame(frame);
            observer.disconnect();
            document.fonts.removeEventListener("loadingdone", schedule);
            window.removeEventListener("resize", schedule);
        };
    }, [ref, content]);
}

export {useMatrixLayout};
