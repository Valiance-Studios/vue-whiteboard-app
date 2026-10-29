/** Keep in sync with `hasValidFields` in `firestore.rules`. */
export const BOARD_TITLE_MAX_LENGTH = 100;

/** Keep in sync with `hasValidFields` in `firestore.rules`. */
export const BOARD_CONTENT_MAX_LENGTH = 100_000;

/** The shortest gap allowed between two writes to one board. Keep in sync with `isOutsideSaveInterval` in `firestore.rules`. */
export const BOARD_MIN_SAVE_INTERVAL_MS = 500;

/**
 * The longest encoded `inks` field (see `src/utils/inks.ts`), about 2,000 color changes.
 * Keep in sync with `isValidInks` in `firestore.rules`.
 */
export const BOARD_INKS_MAX_LENGTH = 20_000;

/**
 * The width, in CSS pixels, at which a board's writing surface is laid out on every screen, then scaled to fit.
 * Text therefore wraps at the same places everywhere, so sketches drawn over it stay on the words they mark.
 */
export const BOARD_SURFACE_WIDTH = 960;

/** The longest encoded stroke (see `encodePoints`). Keep in sync with `isValidStroke` in `firestore.rules`. */
export const STROKE_POINTS_MAX_LENGTH = 20_000;
