import {useEffect, useRef, useState} from 'react';
import {useDebounced, PREVIEW_DEBOUNCE_MILLIS} from './useDebounced.js';

/** A preview authorizes only the exact draft that produced it. */
export function useDraftPreview(key, parse) {
    const parser = useRef(parse);
    parser.current = parse;
    const [result, setResult] = useState({});
    const settled = useDebounced(key, PREVIEW_DEBOUNCE_MILLIS);
    useEffect(() => {
        if (settled !== key) return;
        try {setResult({key, value: parser.current()});}
        catch (error) {setResult({key, error: error.message});}
    }, [settled, key]);
    return {...result, pending: result.key !== key};
}
