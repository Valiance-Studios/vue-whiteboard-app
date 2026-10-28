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
