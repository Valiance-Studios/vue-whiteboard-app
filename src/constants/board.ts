/** Keep in sync with `hasValidFields` in `firestore.rules`. */
export const BOARD_TITLE_MAX_LENGTH = 100;

/** Keep in sync with `hasValidFields` in `firestore.rules`. */
export const BOARD_CONTENT_MAX_LENGTH = 100_000;

/** The shortest gap allowed between two writes to one board. Keep in sync with `isOutsideSaveInterval` in `firestore.rules`. */
export const BOARD_MIN_SAVE_INTERVAL_MS = 500;
