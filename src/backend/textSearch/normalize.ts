/**
 * Normalize `text` to be suitable for further processing for text search.
 * This should be done on both the needle text and the haystack text.
 */
export function normalize(text: string): string {
  // TODO: We probably want to look into Unicode normal forms.
  return text.toLowerCase();
}
