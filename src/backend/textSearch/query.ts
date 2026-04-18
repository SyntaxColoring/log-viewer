import { normalize } from "./normalize";

/**
 * Returns the start indices of all instances of `query` within `text`.
 *
 * This is currently a plain substring search.
 */
export function* findAllMatches(
  text: string,
  query: string,
): Generator<number, void, void> {
  const normalizedText = normalize(text);
  const normalizedQuery = normalize(query);

  if (normalizedQuery !== "") {
    let searchStartIndex = 0;
    while (true) {
      const matchIndex = normalizedText.indexOf(
        normalizedQuery,
        searchStartIndex,
      );
      if (matchIndex === -1) return;
      else {
        yield matchIndex;
        searchStartIndex = matchIndex + normalizedQuery.length;
      }
    }
  }
}

if (import.meta.vitest) {
  const { expect, it } = import.meta.vitest;

  it("Finds all matches", () => {
    expect([...findAllMatches("Hello, world!", "l")]).toStrictEqual([2, 3, 10]);
    expect([...findAllMatches("Hello, world!", "L")]).toStrictEqual([2, 3, 10]);
    expect([...findAllMatches("HELLO, WORLD!", "l")]).toStrictEqual([2, 3, 10]);
    expect([...findAllMatches("sassafras", "as")]).toStrictEqual([1, 7]);
  });
}
