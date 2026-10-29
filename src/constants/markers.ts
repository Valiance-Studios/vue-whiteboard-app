/** The marker colors, in tray order. Keep in sync with `isValidInks` in `firestore.rules`. */
export const MARKER_INKS = ['black', 'blue', 'red', 'green', 'purple', 'orange'] as const;

export type MarkerInk = typeof MARKER_INKS[number];

export interface Marker {
  ink: MarkerInk;
  name: string;
  /** Dark enough to read easily on the white board. */
  color: string;
}

const MARKER_DETAILS: Record<MarkerInk, Omit<Marker, 'ink'>> = {
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

export function isMarkerInk(value: unknown): value is MarkerInk {
  return typeof value === 'string' && (MARKER_INKS as readonly string[]).includes(value);
}

export function markerColor(ink: MarkerInk): string {
  return MARKER_DETAILS[ink].color;
}
