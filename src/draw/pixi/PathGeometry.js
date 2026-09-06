/** Scientific geometry not supplied by Pixi's GraphicsPath. */
export class PathGeometry {
    static line(path, x1, y1, x2, y2) { path.moveTo(x1, y1).lineTo(x2, y2); }

    static grid(path, x, y, w, h, columns, rows) {
        for (let c = 0; c <= columns; c++) this.line(path, x + c*w/columns, y, x + c*w/columns, y + h);
        for (let r = 0; r <= rows; r++) this.line(path, x, y + r*h/rows, x + w, y + r*h/rows);
    }

    static arrowHead(path, x, y, radius, angle, sweep) {
        path.poly([angle, angle + sweep/2 + Math.PI, angle - sweep/2 + Math.PI]
            .flatMap(a => [x + Math.cos(a)*radius, y + Math.sin(a)*radius]));
    }

    static polyline(path, points, dash = []) {
        if (!points.length) return;
        if (!dash.length) {
            path.moveTo(points[0].x, points[0].y);
            for (const point of points.slice(1)) path.lineTo(point.x, point.y);
            return;
        }
        if (dash.some(length => !Number.isFinite(length) || length <= 0)) throw new Error('Dash lengths must be finite and positive');
        const pattern = dash.length % 2 ? [...dash, ...dash] : dash;
        let segment = 0, remaining = pattern[0];
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
            let offset = 0;
            while (offset < length) {
                const end = Math.min(length, offset + remaining);
                if (segment % 2 === 0) path.moveTo(a.x + (b.x-a.x)*offset/length, a.y + (b.y-a.y)*offset/length)
                    .lineTo(a.x + (b.x-a.x)*end/length, a.y + (b.y-a.y)*end/length);
                remaining -= end - offset;
                offset = end;
                if (remaining < 1e-9) { segment = (segment + 1) % pattern.length; remaining = pattern[segment]; }
            }
        }
    }
}
