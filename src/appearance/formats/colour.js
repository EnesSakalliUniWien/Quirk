/** Encode shared sRGB data for renderers that accept hex or rgba strings. */
export function colourString({r, g, b, alpha}) {
    if (alpha === 0) return 'transparent';
    if (alpha !== 1) return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    return '#' + [r, g, b].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}
