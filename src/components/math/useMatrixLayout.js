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
            // Every entry takes its row's height, so rows give the same maximum with far fewer reads.
            const rows = [...track.querySelectorAll(".matrix-table mtr")];
            const height = Math.ceil(rows.reduce((max, row) => Math.max(max, row.getBoundingClientRect().height / scale), 0));
            if (height) track.style.setProperty("--matrix-row-height", `${height}px`);
            const matrices = [...track.querySelectorAll('.algebra-equation > .matrix-factor > div > .matrix-math')];
            const matrixHeight = Math.max(0, ...matrices.map(matrix => matrix.getBoundingClientRect().height / scale));
            if (matrixHeight) track.style.setProperty('--equation-matrix-height', `${matrixHeight}px`);
            else track.style.removeProperty('--equation-matrix-height');
            const cards = [...track.querySelectorAll(".algebra-step")];
            const width = Math.ceil(cards.reduce((max, card) => Math.max(max, card.getBoundingClientRect().width / scale), 0));
            if (width) track.style.setProperty("--algebra-card-width", `${width}px`);
            track.scrollLeft = scroll;
            track.dataset.layoutReady = "true";
        };
        const schedule = () => {cancelAnimationFrame(frame); frame = requestAnimationFrame(measure);};
        measure();
        track.addEventListener("toggle", schedule, true);
        let lastWidth = track.clientWidth;
        const observer = new ResizeObserver(() => {
            if (track.clientWidth !== lastWidth) {lastWidth = track.clientWidth; schedule();}
        });
        observer.observe(track);
        // Fonts still loading change entry sizes later; loaded fonts need no second pass.
        if (document.fonts.status !== "loaded") document.fonts.ready.then(() => {if (active) schedule();});
        document.fonts.addEventListener("loadingdone", schedule);
        window.addEventListener("resize", schedule);
        return () => {
            active = false;
            cancelAnimationFrame(frame);
            observer.disconnect();
            track.removeEventListener("toggle", schedule, true);
            document.fonts.removeEventListener("loadingdone", schedule);
            window.removeEventListener("resize", schedule);
        };
    }, [ref, content]);
}

export {useMatrixLayout};
