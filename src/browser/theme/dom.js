import { appearanceFor } from '../../appearance/Appearance.js';
import { colourString } from '../../appearance/formats/colour.js';
import { phaseColor } from '../../appearance/formats/phase.js';
import { Typography as typography } from '../../appearance/formats/typography.js';

/**
 * The dial's colours: its face, ring, core and arc track, and the index arc's tone per rotation axis.
 * @param {!Object} dial
 * @returns {!Object.<!string, !string>}
 */
function dialProperties(dial) {
    return Object.fromEntries(['face', 'ring', 'core', 'track', 'x', 'y', 'z', 'plain'].map(name =>
        [`--dial-${name}`, colourString(dial[name])]));
}

export function domFor(scheme) {
    const appearance = appearanceFor(scheme);
    const background = colourString(appearance.colours.ui.background);
    const foreground = colourString(appearance.colours.ui.foreground);
    const secondary = colourString(appearance.colours.ui.secondary);
    const controlSurface = colourString(appearance.colours.ui.controlSurface);
    const brandInk = colourString(appearance.colours.ui.brandInk);
    const border = colourString(appearance.colours.ui.border);
    const primary = colourString(appearance.colours.ui.primary);

    return Object.freeze({
        "--forge-range-fill": `color-mix(in srgb, ${foreground} ${appearance.opacity.forgeRange * 100}%, transparent)`,
        "--border-width": `${appearance.borders.width.regular}px`,
        "--border-width-strong": `${appearance.borders.width.strong}px`,
        "--border-width-focus": `${appearance.borders.width.focus}px`,
        "--radius-small": `${appearance.borders.radius.small}px`,
        "--radius-medium": `${appearance.borders.radius.medium}px`,
        "--font-size-root": `${appearance.typography.size.root}px`,
        "--space-small": `${appearance.spacing.small}px`,
        "--space-medium": `${appearance.spacing.medium}px`,
        "--spacing": `${appearance.spacing.unit / appearance.typography.size.root}rem`,
        "--layer-preview": "1000",
        "--layer-popover": "1010",
        "--layer-menu": "1020",
        "--text-caption": `${appearance.typography.size.caption / appearance.typography.size.root}rem`,
        "--text-small": `${appearance.typography.size.small / appearance.typography.size.root}rem`,
        "--text-body": `${appearance.typography.size.body / appearance.typography.size.root}rem`,
        "--text-heading": `${appearance.typography.size.heading / appearance.typography.size.root}rem`,
        "--text-title": `${appearance.typography.size.title / appearance.typography.size.root}rem`,
        "--font-sans": typography.DEFAULT_FONT_FAMILY,
        "--font-mono": typography.MONO_FONT_FAMILY,
        "--table-divider": colourString(appearance.colours.ui.tableDivider),
        "--transport-surface": colourString(appearance.colours.ui.transportSurface),
        "--search-muted": colourString(appearance.colours.text.muted),
        "--search-surface": colourString(appearance.colours.ui.searchSurface),
        "--focus-shadow": colourString(appearance.colours.ui.focusShadow),
        "--tile-hover": colourString(appearance.colours.ui.tileHover),
        "--tile-outline": colourString(appearance.colours.stroke.guide),
        "--focus-outline": colourString(appearance.colours.stroke.guide),
        "--inset-surface": secondary,
        "--sidebar-muted": colourString(appearance.colours.text.muted),
        "--control-border": colourString(appearance.colours.ui.controlBorder),
        "--control-surface": controlSurface,
        "--control-hover": colourString(appearance.colours.ui.controlHover),
        "--input-surface": controlSurface,
        "--brand-ink": brandInk,
        "--brand-surface": colourString(appearance.colours.ui.brandSurface),
        "--brand-border": colourString(appearance.colours.ui.brandBorder),
        "--brand-glow": colourString(appearance.colours.ui.brandGlow),
        "--panel-heading": brandInk,
        "--panel-glow": colourString(appearance.colours.ui.panelGlow),
        "--panel-primary-hover": colourString(appearance.colours.ui.panelPrimaryHover),
        "--panel-option-surface": colourString(appearance.colours.ui.panelOptionSurface),
        "--panel-option-border": colourString(appearance.colours.ui.panelOptionBorder),
        "--panel-link": colourString(appearance.colours.text.muted),
        "--panel-link-hover": colourString(appearance.colours.text.primary),
        "--error-border": colourString(appearance.colours.ui.errorBorder),
        "--sidebar-scrollbar": colourString(appearance.colours.ui.sidebarScrollbar),
        "--shadow-popup": colourString(appearance.colours.ui.shadowPopup),
        "--shadow-banner": colourString(appearance.colours.ui.shadowBanner),
        "--shadow-control": colourString(appearance.colours.ui.shadowControl),
        "--state-probability-fill": colourString(appearance.colours.probability.fill),
        "--state-probability-back": colourString(appearance.colours.probability.background),
        "--operator": colourString(appearance.colours.operation.fill),
        "--bloch-axis-x": colourString(appearance.colours.bloch.axisX),
        "--bloch-axis-y": colourString(appearance.colours.bloch.axisY),
        "--bloch-axis-z": colourString(appearance.colours.bloch.axisZ),
        ...dialProperties(appearance.colours.dial),
        "--phase-legend": `linear-gradient(to right, ${Array.from({ length: 9 }, (_, i) => phaseColor(-180 + i * 45, 1, appearance.phase)).join(", ")})`,
        "--app-font-sans": typography.DEFAULT_FONT_FAMILY,
        "--app-font-mono": typography.MONO_FONT_FAMILY,
        "--background": background,
        "--foreground": foreground,
        "--card": colourString(appearance.colours.surface.quiet),
        "--card-foreground": foreground,
        "--popover": colourString(appearance.colours.surface.quiet),
        "--popover-foreground": foreground,
        "--primary": primary,
        "--primary-foreground": colourString(appearance.colours.surface.quiet),
        "--secondary": secondary,
        "--secondary-foreground": foreground,
        "--muted": secondary,
        "--muted-foreground": colourString(appearance.colours.text.muted),
        "--accent": secondary,
        "--accent-foreground": foreground,
        "--destructive": colourString(appearance.colours.error.text),
        "--border": border,
        "--input": colourString(appearance.colours.ui.input),
        "--ring": colourString(appearance.colours.stroke.guide),
        "--radius": `${appearance.borders.radius.control / appearance.typography.size.root}rem`,
        "--sidebar": background,
        "--sidebar-foreground": foreground,
        "--sidebar-primary": primary,
        "--sidebar-primary-foreground": colourString(appearance.colours.surface.quiet),
        "--sidebar-accent": secondary,
        "--sidebar-accent-foreground": foreground,
        "--sidebar-border": border,
        "--sidebar-ring": colourString(appearance.colours.stroke.guide),
        "--button-ghost-hover": `color-mix(in oklab, ${secondary} ${appearance.opacity.ghostHover * 100}%, transparent)`,
        "--button-focus-shadow": `color-mix(in oklab, ${colourString(appearance.colours.stroke.guide)} ${appearance.opacity.focus * 100}%, transparent)`,
        "--matrix-active-surface": `color-mix(in oklab, ${colourString(appearance.colours.stroke.guide)} ${appearance.opacity.matrixActive * 100}%, transparent)`,
        "--operator-control-surface": `color-mix(in oklab, ${foreground} ${appearance.opacity.operatorControl * 100}%, transparent)`,
    });
}
