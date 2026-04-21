import rough from 'roughjs';
import type { Options, PathInfo } from 'roughjs/bin/core';

const generator = rough.generator();

export function roughPath(d: string, opts: Options): PathInfo[] {
  const drawable = generator.path(d, opts);
  return generator.toPaths(drawable);
}

export function roughLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: Options
): PathInfo[] {
  const drawable = generator.line(x1, y1, x2, y2, opts);
  return generator.toPaths(drawable);
}

export function roughRect(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: Options
): PathInfo[] {
  const drawable = generator.rectangle(x, y, w, h, opts);
  return generator.toPaths(drawable);
}

export function roughCircle(
  x: number,
  y: number,
  diameter: number,
  opts: Options
): PathInfo[] {
  const drawable = generator.circle(x, y, diameter, opts);
  return generator.toPaths(drawable);
}

export function roughPolygon(
  points: [number, number][],
  opts: Options
): PathInfo[] {
  const drawable = generator.polygon(points, opts);
  return generator.toPaths(drawable);
}
