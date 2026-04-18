import { describe, expect, test } from "vitest";

import * as arrayUtils from "./arrayUtils";

describe("concatUint8Array()", () => {
  test.each([
    { a: [], b: [], expectedResult: [] },
    { a: [1, 2, 3], b: [], expectedResult: [1, 2, 3] },
    { a: [], b: [1, 2, 3], expectedResult: [1, 2, 3] },
    { a: [1, 2, 3], b: [4, 5, 6], expectedResult: [1, 2, 3, 4, 5, 6] },
  ])("concatUint8Array($a, $b)", ({ a, b, expectedResult }) => {
    const result = arrayUtils.concatUint8Array(
      new Uint8Array(a),
      new Uint8Array(b),
    );
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
      const result = arrayUtils.splitUint8Array(new Uint8Array(source), split);
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
