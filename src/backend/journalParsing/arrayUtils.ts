export interface SplitUint8ArrayResult {
  segment: Uint8Array;
  begin: number;
  end: number;
}

/**
 * Like {@link String.prototype.split()}, but with a `Uint8Array`.
 *
 * To avoid copies, this returns mutable subarrays of the original array.
 * Treat the original array and the returned subarrays as immutable
 * to avoid modifications leaking between them.
 */
export function splitUint8Array(
  source: Uint8Array,
  splitOnByteValue: number,
): SplitUint8ArrayResult[] {
  const result: SplitUint8ArrayResult[] = [];
  while (true) {
    const splitIndex = source.indexOf(splitOnByteValue);
    if (splitIndex === -1) {
      break;
    } else {
      const segment = source.subarray(0, splitIndex);

      // The caller could do this themselves, but we don't want them to rely on the fact that
      // we're returning subarrays with a shared underlying ArrayBuffer.
      const begin = segment.byteOffset;
      const end = begin + segment.byteLength;

      result.push({ segment, begin, end });
      source = source.subarray(splitIndex + 1);
    }
  }

  const begin = source.byteOffset;
  const end = begin + source.byteLength;
  result.push({ segment: source, begin, end });

  return result;
}

/**
 * Concatenates two `Uint8Array`s.
 */
export function concatUint8Array(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
}

if (import.meta.vitest) {
  const { describe, expect, test } = import.meta.vitest;

  describe("concatUint8Array()", () => {
    test.each([
      { a: [], b: [], expectedResult: [] },
      { a: [1, 2, 3], b: [], expectedResult: [1, 2, 3] },
      { a: [], b: [1, 2, 3], expectedResult: [1, 2, 3] },
      { a: [1, 2, 3], b: [4, 5, 6], expectedResult: [1, 2, 3, 4, 5, 6] },
    ])("concatUint8Array($a, $b)", ({ a, b, expectedResult }) => {
      const result = concatUint8Array(new Uint8Array(a), new Uint8Array(b));
      expect(result).toStrictEqual(new Uint8Array(expectedResult));
    });
  });

  describe("splitUint8Array()", () => {
    test.each([
      {
        source: [],
        split: 100,
        expectedResult: [{ begin: 0, end: 0, segment: [] }],
      },
      {
        source: [1, 2, 100, 3, 4, 100, 5, 6],
        split: 100,
        expectedResult: [
          { begin: 0, end: 2, segment: [1, 2] },
          { begin: 3, end: 5, segment: [3, 4] },
          { begin: 6, end: 8, segment: [5, 6] },
        ],
      },
      {
        source: [100, 1, 2, 3, 100],
        split: 100,
        expectedResult: [
          { begin: 0, end: 0, segment: [] },
          { begin: 1, end: 4, segment: [1, 2, 3] },
          { begin: 5, end: 5, segment: [] },
        ],
      },
      {
        source: [1, 2, 3],
        split: 100,
        expectedResult: [{ begin: 0, end: 3, segment: [1, 2, 3] }],
      },
    ])(
      "splitUint8Array($source, $split)",
      ({ source, split, expectedResult }) => {
        const result = splitUint8Array(new Uint8Array(source), split);
        expect(result).toStrictEqual(
          expectedResult.map(({ segment, begin, end }) => ({
            segment: new Uint8Array(segment),
            begin,
            end,
          })),
        );
      },
    );
  });
}
