/** Normalizes text for case-insensitive search anywhere in the title. */
export function toSearchable(text: string): string {
  return text.trim().toLowerCase();
}
