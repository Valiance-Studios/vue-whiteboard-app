/** Normalizes text for case-insensitive prefix search. */
export function toSearchable(text: string): string {
  return text.trim().toLowerCase();
}
