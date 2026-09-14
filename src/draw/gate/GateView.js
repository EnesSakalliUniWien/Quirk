/** React keys identify each gate occurrence; scientific renderers describe its contents. */
export function renderGateView(view, key, args, renderer) {
    return view.group(key, child => renderer(args.withPainter(child)));
}
