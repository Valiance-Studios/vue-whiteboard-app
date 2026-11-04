import type {HexColor} from '@/utils/color';

import {isHexColor} from '@/utils/color';

/** The named marker colors, in tray order, after the RGB marker. Keep in sync with `isValidInks` in `firestore.rules`. */
export const MARKER_INKS = ['black', 'blue', 'red', 'green', 'purple', 'orange'] as const;

export type NamedInk = typeof MARKER_INKS[number];

/** What a stretch of writing is colored with: a named marker, or the exact color the RGB marker had when it was written. */
export type MarkerInk = NamedInk | HexColor;

export interface Marker {
  ink: NamedInk;
  name: string;
  /** Dark enough to read easily on the white board. */
  color: string;
}

const MARKER_DETAILS: Record<NamedInk, Omit<Marker, 'ink'>> = {
  black: {name: 'Black', color: '#1c2330'},
  blue: {name: 'Blue', color: '#1f3b73'},
  red: {name: 'Red', color: '#b3261e'},
  green: {name: 'Green', color: '#1e6b3a'},
  purple: {name: 'Purple', color: '#5b2a86'},
  orange: {name: 'Orange', color: '#b45309'},
};

export const MARKERS: readonly Marker[] = MARKER_INKS.map((ink) => ({ink, ...MARKER_DETAILS[ink]}));

/** The ink of writing with no stored color, such as boards written before markers existed. */
export const DEFAULT_INK: MarkerInk = 'blue';

export const CUSTOM_MARKER_NAME = 'RGB';

/** The RGB marker's color until its owner picks one. */
export const DEFAULT_CUSTOM_MARKER_COLOR: HexColor = '#d81b60';

export function isMarkerInk(value: unknown): value is MarkerInk {
  return isHexColor(value) || (typeof value === 'string' && (MARKER_INKS as readonly string[]).includes(value));
}

export function markerColor(ink: MarkerInk): string {
  return isHexColor(ink) ? ink : MARKER_DETAILS[ink].color;
}
