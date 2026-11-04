import {describe, expect, it} from 'vitest';
import {isMarkerInk, markerColor} from '@/constants/markers';

describe('marker inks', () => {
  it('accepts named inks and hex colors', () => {
    expect(isMarkerInk('red')).toBe(true);
    expect(isMarkerInk('#d81b60')).toBe(true);
  });

  it('rejects anything else, so stored values can never reach a style attribute unchecked', () => {
    expect(isMarkerInk('pink')).toBe(false);
    expect(isMarkerInk('#d81b60;background:url(x)')).toBe(false);
  });

  it('gives a named ink its color, and a hex ink itself', () => {
    expect(markerColor('red')).toBe('#b3261e');
    expect(markerColor('#d81b60')).toBe('#d81b60');
  });
});
