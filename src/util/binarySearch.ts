export function binarySearch<T>(haystack: T[], needle: T): number | null {
  let low = 0;
  let high = haystack.length - 1;
  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2);
    const midValue = haystack[mid];
    if (midValue < needle) low = mid + 1;
    else high = mid - 1;
  }
  if (low >= haystack.length) return null;
  if (haystack[low] !== needle) return null;
  return low;
}

if (import.meta.vitest) {
  const { expect, test } = import.meta.vitest;

  test.each([
    { haystack: [], needle: 1, expectedIndex: null },
    { haystack: [10], needle: 10, expectedIndex: 0 },
    { haystack: [10], needle: 11, expectedIndex: null },
    { haystack: [1, 2, 3, 4, 5], needle: 1, expectedIndex: 0 },
    { haystack: [1, 2, 3, 4, 5], needle: 3, expectedIndex: 2 },
    { haystack: [1, 2, 3, 4, 5], needle: 5, expectedIndex: 4 },
    { haystack: [1, 2, 3, 4, 5], needle: 0, expectedIndex: null },
    { haystack: [1, 2, 3, 4, 5], needle: 6, expectedIndex: null },
  ])(
    "binarySearch($haystack, $needle) -> $expectedIndex",
    ({ haystack, needle, expectedIndex }) => {
      expect(binarySearch(haystack, needle)).toStrictEqual(expectedIndex);
    },
  );

  test("returns an index pointing to the matched value when duplicates exist", () => {
    const haystack = [1, 2, 2, 2, 3];
    const result = binarySearch(haystack, 2);
    expect(result).not.toBeNull();
    expect(haystack[result!]).toStrictEqual(2);
  });
}
