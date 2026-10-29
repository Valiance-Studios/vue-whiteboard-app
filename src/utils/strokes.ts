import type {Stroke, StrokePoint} from '@/types/sketch';

/** Points are kept to half a surface pixel, and pressure to 1%, which is finer than the eye can tell on a board. */
const POSITION_STEPS = 2;
const PRESSURE_STEPS = 100;

/**
 * Writes points compactly for storage: each point's rounded x, y and pressure as the difference from the
 * previous point's, all comma-separated. A stroke of a few hundred points comes to a few kilobytes at most.
 */
export function encodePoints(points: readonly StrokePoint[]): string {
  const values: number[] = [];
  let previous: [number, number, number] = [0, 0, 0];

  for (const [x, y, pressure] of points) {
    const current: [number, number, number] = [
      Math.round(x * POSITION_STEPS),
      Math.round(y * POSITION_STEPS),
      Math.round(pressure * PRESSURE_STEPS),
    ];
    values.push(current[0] - previous[0], current[1] - previous[1], current[2] - previous[2]);
    previous = current;
  }

  return values.join(',');
}

/** Reads points written by `encodePoints`. Malformed values give no points, so a broken stroke is simply not drawn. */
export function decodePoints(encoded: string): StrokePoint[] {
  const values = encoded.split(',').map(Number);

  if (encoded === '' || values.length % 3 !== 0 || !values.every(Number.isInteger)) {
    return [];
  }

  const points: StrokePoint[] = [];
  let [x, y, pressure] = [0, 0, 0];

  for (let i = 0; i < values.length; i += 3) {
    x += values[i];
    y += values[i + 1];
    pressure += values[i + 2];
    points.push([x / POSITION_STEPS, y / POSITION_STEPS, pressure / PRESSURE_STEPS]);
  }

  return points;
}

function distanceToSegment([px, py]: readonly number[], [ax, ay]: readonly number[], [bx, by]: readonly number[]): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Drops points that barely change the line's shape (Ramer–Douglas–Peucker), keeping every point that strays
 * more than `tolerance` surface pixels from the simplified line. The ends are always kept.
 */
export function simplifyPoints(points: readonly StrokePoint[], tolerance: number): StrokePoint[] {
  if (points.length <= 2) {
    return [...points];
  }

  const last = points.length - 1;
  let furthest = 0;
  let furthestDistance = 0;

  for (let i = 1; i < last; i++) {
    const distance = distanceToSegment(points[i], points[0], points[last]);

    if (distance > furthestDistance) {
      furthest = i;
      furthestDistance = distance;
    }
  }

  if (furthestDistance <= tolerance) {
    return [points[0], points[last]];
  }

  return [
    ...simplifyPoints(points.slice(0, furthest + 1), tolerance).slice(0, -1),
    ...simplifyPoints(points.slice(furthest), tolerance),
  ];
}

/** Whether a point is within `radius` surface pixels of the stroke's line, as the eraser needs. */
export function strokeHitsPoint(stroke: Stroke, point: readonly [number, number], radius: number): boolean {
  const {points} = stroke;

  if (points.length === 1) {
    return Math.hypot(point[0] - points[0][0], point[1] - points[0][1]) <= radius;
  }

  for (let i = 1; i < points.length; i++) {
    if (distanceToSegment(point, points[i - 1], points[i]) <= radius) {
      return true;
    }
  }

  return false;
}

/** The lowest point any stroke reaches, so the board can grow to fit a sketch. */
export function sketchBottom(strokes: readonly Stroke[]): number {
  let bottom = 0;

  for (const stroke of strokes) {
    for (const [, y] of stroke.points) {
      bottom = Math.max(bottom, y);
    }
  }

  return bottom;
}

/**
 * Simplifies a finished stroke for saving: barely-visible detail goes first, and a very long scribble is
 * simplified further until its encoding fits within `maxLength`, rather than failing to save.
 */
export function fitPoints(points: readonly StrokePoint[], maxLength: number): StrokePoint[] {
  let tolerance = 0.5;
  let fitted = simplifyPoints(points, tolerance);

  while (encodePoints(fitted).length > maxLength && fitted.length > 2) {
    tolerance *= 2;
    fitted = simplifyPoints(points, tolerance);
  }

  return fitted;
}
