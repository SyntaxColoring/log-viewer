/** A range of indexes (inclusive, first <= i <= last). `null` represents an empty set. */
export type Range = {
  first: number;
  last: number;
} | null;

export function rangeToArray(range: Range): number[] {
  if (range === null) return [];
  return Array.from(
    { length: range.last - range.first + 1 },
    (_, i) => range.first + i,
  );
}

export function expandRange(range: Range, expandBy: number): Range {
  if (range === null) return null;
  return {
    first: range.first - expandBy,
    last: range.last + expandBy,
  };
}

/** Clamp toBeClamped so it's entirely contained within clampTo. */
export function clampRange(toBeClamped: Range, clampTo: Range): Range {
  if (toBeClamped === null || clampTo === null) return null;
  const clampedFirst = Math.max(toBeClamped.first, clampTo.first);
  const clampedLast = Math.min(toBeClamped.last, clampTo.last);
  if (clampedFirst > clampedLast) return null;
  return {
    first: clampedFirst,
    last: clampedLast,
  };
}

export function rangesEqual(a: Range, b: Range): boolean {
  return a?.first === b?.first && a?.last === b?.last;
}

/** Subtract b from a, returning one or two non-overlapping ranges. */
export function subtractRange(a: Range, b: Range): [Range, Range] {
  if (b === null) return [a, null];
  if (a === null) return [null, null];

  if (a.last < b.first || b.last < a.first) {
    return [a, null];
  }

  let left: Range = null;
  if (a.first < b.first) {
    const end = Math.min(a.last, b.first - 1);
    if (a.first <= end) {
      left = { first: a.first, last: end };
    }
  }

  let right: Range = null;
  if (b.last < a.last) {
    const start = Math.max(a.first, b.last + 1);
    if (start <= a.last) {
      right = { first: start, last: a.last };
    }
  }

  return [left, right];
}
