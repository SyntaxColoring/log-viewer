import { describe, expect, test } from "vitest";

import {
  clampRange,
  expandRange,
  rangeToArray,
  rangesEqual,
  subtractRange,
} from "./ranges";

describe("rangeToArray()", () => {
  test.each([
    { range: null, expected: [] as number[] },
    { range: { first: 5, last: 5 }, expected: [5] },
    { range: { first: 2, last: 6 }, expected: [2, 3, 4, 5, 6] },
    { range: { first: -1, last: 1 }, expected: [-1, 0, 1] },
  ])("$range", ({ range, expected }) => {
    expect(rangeToArray(range)).toStrictEqual(expected);
  });
});

describe("expandRange()", () => {
  test("returns null when the input range is null", () => {
    expect(expandRange(null, 3)).toBeNull();
  });

  test("expands range by expandBy on both ends", () => {
    expect(expandRange({ first: 1, last: 2 }, 2)).toStrictEqual({
      first: -1,
      last: 4,
    });
  });
});

describe("clampRange()", () => {
  test.each([
    {
      // The source fits entirely inside the clamp, so the clamp has no effect.
      toBeClamped: { first: 10, last: 20 },
      clampTo: { first: 0, last: 100 },
      expected: { first: 10, last: 20 },
    },
    {
      // The clamp is empty, so the result is empty.
      toBeClamped: { first: 10, last: 20 },
      clampTo: null,
      expected: null,
    },
    {
      // The source is empty, so the result is empty.
      toBeClamped: null,
      clampTo: { first: 0, last: 100 },
      expected: null,
    },
    {
      // The source is entirely outside the clamp, so the result is empty.
      toBeClamped: { first: 10, last: 20 },
      clampTo: { first: 21, last: 21 },
      expected: null,
    },
    {
      // The source intersects the clamp, so the result is the intersection.
      toBeClamped: { first: 10, last: 20 },
      clampTo: { first: 5, last: 15 },
      expected: { first: 10, last: 15 },
    },
    {
      // The source intersects the clamp, so the result is the intersection.
      toBeClamped: { first: 10, last: 20 },
      clampTo: { first: 15, last: 25 },
      expected: { first: 15, last: 20 },
    },
  ])(
    "clampRange($toBeClamped, $clampTo) -> $expected",
    ({ toBeClamped, clampTo, expected }) => {
      expect(clampRange(toBeClamped, clampTo)).toStrictEqual(expected);
    },
  );
});

describe("rangesEqual()", () => {
  test.each([
    { a: null, b: null, expected: true },
    {
      a: { first: 1, last: 2 },
      b: { first: 1, last: 2 },
      expected: true,
    },
    {
      a: { first: 1, last: 2 },
      b: { first: 1, last: 3 },
      expected: false,
    },
    { a: null, b: { first: 1, last: 2 }, expected: false },
    { a: { first: 1, last: 2 }, b: null, expected: false },
  ])("rangesEqual($a, $b) -> $expected", ({ a, b, expected }) => {
    expect(rangesEqual(a, b)).toBe(expected);
  });
});

describe("subtractRange()", () => {
  test("when b is null, leaves a unchanged and returns null as the second range", () => {
    expect(subtractRange({ first: 1, last: 5 }, null)).toStrictEqual([
      { first: 1, last: 5 },
      null,
    ]);
    expect(subtractRange(null, null)).toStrictEqual([null, null]);
  });

  test.each([
    {
      name: "no overlap: b is entirely to the right",
      a: { first: 1, last: 3 },
      b: { first: 10, last: 12 },
      expected: [{ first: 1, last: 3 }, null] as const,
    },
    {
      name: "no overlap: b is entirely to the left",
      a: { first: 10, last: 12 },
      b: { first: 1, last: 3 },
      expected: [{ first: 10, last: 12 }, null] as const,
    },
    {
      name: "b fully covers a",
      a: { first: 2, last: 8 },
      b: { first: 0, last: 20 },
      expected: [null, null] as const,
    },
    {
      name: "b splits a into left and right",
      a: { first: 0, last: 10 },
      b: { first: 3, last: 7 },
      expected: [
        { first: 0, last: 2 },
        { first: 8, last: 10 },
      ] as const,
    },
    {
      name: "b overlaps the left side only",
      a: { first: 0, last: 10 },
      b: { first: 0, last: 4 },
      expected: [null, { first: 5, last: 10 }] as const,
    },
    {
      name: "b overlaps the right side only",
      a: { first: 0, last: 10 },
      b: { first: 6, last: 10 },
      expected: [{ first: 0, last: 5 }, null] as const,
    },
    {
      name: "single-index a removed entirely by b",
      a: { first: 5, last: 5 },
      b: { first: 5, last: 5 },
      expected: [null, null] as const,
    },
  ])("$name", ({ a, b, expected }) => {
    expect(subtractRange(a, b)).toStrictEqual(expected);
  });
});
