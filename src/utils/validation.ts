import {BOARD_TITLE_MAX_LENGTH} from '@/constants/board';

/** A Vuetify field rule: `true` when valid, otherwise the message to show. */
export type ValidationRule = (value: string) => true | string;

export const boardTitleRules: readonly ValidationRule[] = [
  (value) => value.trim().length > 0 || 'Title is required.',
  (value) => value.length <= BOARD_TITLE_MAX_LENGTH || `Title must be ${BOARD_TITLE_MAX_LENGTH} characters or fewer.`,
];

/** The first message `rules` give for `value`, or `null` if it passes them all. */
export function firstValidationError(rules: readonly ValidationRule[], value: string): string | null {
  for (const rule of rules) {
    const result = rule(value);

    if (result !== true) {
      return result;
    }
  }

  return null;
}
