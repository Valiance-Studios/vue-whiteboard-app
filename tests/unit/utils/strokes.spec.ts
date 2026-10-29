import type {Stroke, StrokePoint} from '@/types/sketch';

import {describe, expect, it} from 'vitest';
import {decodePoints, encodePoints, fitPoints, simplifyPoints, sketchBottom, strokeHitsPoint} from '@/utils/strokes';

function stroke(points: StrokePoint[]): Stroke {
  return {id: 's', ink: 'red', pen: false, points, drawnAt: 0};
}

describe('encodePoints and decodePoints', () => {
  it('round-trips points to half a pixel and 1% pressure', () => {
    const points: StrokePoint[] = [[10, 20, 0.5], [10.5, 21, 0.55], [12, 19.5, 1]];

    expect(decodePoints(encodePoints(points))).toEqual(points);
  });

  it('rounds finer detail', () => {
    expect(decodePoints(encodePoints([[10.26, 3.74, 0.333]]))).toEqual([[10.5, 3.5, 0.33]]);
  });

  it('stores each point after the first as a difference', () => {
    expect(encodePoints([[10, 10, 0.5], [11, 10, 0.5]])).toBe('20,20,50,2,0,0');
  });

  it.each(['', '1,2', '1,2,x', '1.5,2,3'])('gives no points for malformed %j', (encoded) => {
    expect(decodePoints(encoded)).toEqual([]);
  });
});

describe('simplifyPoints', () => {
  it('drops points along a straight line, keeping the ends', () => {
    const line: StrokePoint[] = [[0, 0, 0.5], [1, 1, 0.5], [2, 2, 0.5], [3, 3, 0.5]];

    expect(simplifyPoints(line, 0.5)).toEqual([[0, 0, 0.5], [3, 3, 0.5]]);
  });

  it('keeps a corner', () => {
    const corner: StrokePoint[] = [[0, 0, 0.5], [5, 0, 0.5], [10, 0, 0.5], [10, 5, 0.5], [10, 10, 0.5]];

    expect(simplifyPoints(corner, 0.5)).toEqual([[0, 0, 0.5], [10, 0, 0.5], [10, 10, 0.5]]);
  });
});

describe('fitPoints', () => {
  it('simplifies a long scribble until it fits', () => {
    const scribble: StrokePoint[] = Array.from({length: 5000}, (_, i) => [i % 2 === 0 ? 0 : 300, i * 0.2, 0.5]);

    const fitted = fitPoints(scribble, 20_000);

    expect(encodePoints(fitted).length).toBeLessThanOrEqual(20_000);
    expect(fitted[0]).toEqual(scribble[0]);
    expect(fitted.at(-1)).toEqual(scribble.at(-1));
  });
});

describe('strokeHitsPoint', () => {
  const line = stroke([[0, 0, 0.5], [100, 0, 0.5]]);

  it('catches a point near the line', () => {
    expect(strokeHitsPoint(line, [50, 8], 10)).toBe(true);
  });

  it('misses a point beyond the radius or past the ends', () => {
    expect(strokeHitsPoint(line, [50, 12], 10)).toBe(false);
    expect(strokeHitsPoint(line, [115, 0], 10)).toBe(false);
  });

  it('catches a dot', () => {
    expect(strokeHitsPoint(stroke([[5, 5, 0.5]]), [8, 9], 10)).toBe(true);
  });
});

describe('sketchBottom', () => {
  it('is the lowest point of any stroke', () => {
    expect(sketchBottom([stroke([[0, 40, 0.5]]), stroke([[0, 10, 0.5], [0, 90, 0.5]])])).toBe(90);
    expect(sketchBottom([])).toBe(0);
  });
});
