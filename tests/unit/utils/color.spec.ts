import {describe, expect, it} from 'vitest';
import {hexToRgb, isHexColor, parseHexColor, rgbToHex} from '@/utils/color';

describe('isHexColor', () => {
  it.each(['#000000', '#d81b60'])('accepts %s', (value) => {
    expect(isHexColor(value)).toBe(true);
  });

  it.each(['#D81B60', 'd81b60', '#abc', '#d81b6', '#d81b600', 'red', 'red;background:url(x)', null, 7])('rejects %s', (value) => {
    expect(isHexColor(value)).toBe(false);
  });
});

describe('parseHexColor', () => {
  it.each([
    ['#d81b60', '#d81b60'],
    ['d81b60', '#d81b60'],
    ['#D81B60', '#d81b60'],
    ['  #d81b60 ', '#d81b60'],
    ['#abc', '#aabbcc'],
    ['ABC', '#aabbcc'],
  ])('reads %s as %s', (input, expected) => {
    expect(parseHexColor(input)).toBe(expected);
  });

  it.each(['', '#', '#ab', '#abcd', '#abcde', '#abcdefa', 'blue', '#ggg'])('rejects "%s"', (input) => {
    expect(parseHexColor(input)).toBeNull();
  });
});

describe('RGB conversion', () => {
  it('converts hex to RGB', () => {
    expect(hexToRgb('#d81b60')).toEqual({red: 216, green: 27, blue: 96});
  });

  it('converts RGB to hex, keeping leading zeros', () => {
    expect(rgbToHex({red: 0, green: 10, blue: 255})).toBe('#000aff');
  });
});
