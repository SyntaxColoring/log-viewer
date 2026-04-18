// todo: We're currently using JS sets for our indexes of entry numbers.
// This is wasteful. They tend to be implemented as hash maps, but
// contiguous arrays of sorted numbers would work better for our case:
// fewer allocations, better memory efficiency, less pointer chasing,
// the possibility of adding delta compression, faster insertion....

export function intersect<T>(sets: Set<T>[]): Set<T> {
  const result = new Set<T>();

  if (sets.length > 0) {
    // Optimization: query the sets with fewest elements first,
    // assuming they're most likely to be missing elements from other sets.
    const sortedSets = sets.slice().sort((a, b) => a.size - b.size);
    const firstSet = sortedSets[0];
    const otherSets = sortedSets.slice(1);

    for (const element of firstSet) {
      const elementInAllSets = lazyAll(
        lazyMap(otherSets, (otherSet) => otherSet.has(element)),
      );
      if (elementInAllSets) result.add(element);
    }
  }

  return result;
}

export function union<T>(sets: Set<T>[]): Set<T> {
  const result = new Set<T>();
  for (const set of sets) {
    for (const element of set) {
      result.add(element);
    }
  }
  return result;
}

function* lazyMap<I, O>(
  iterable: Iterable<I>,
  map: (element: I) => O,
): Generator<O> {
  for (const element of iterable) {
    yield map(element);
  }
}

/** Returns whether all elements of iterable are true, bailing out early if any is false. */
function lazyAll(iterable: Iterable<boolean>): boolean {
  for (const element of iterable) {
    if (!element) return false;
  }
  return true;
}

if (import.meta.vitest) {
  const { expect, test } = import.meta.vitest;

  test("intersect", () => {
    expect(
      intersect([
        new Set([0, 1, 2, 3]),
        new Set([1, 2, 3, 4]),
        new Set([2, 3, 4, 5]),
      ]),
    ).toStrictEqual(new Set([2, 3]));
  });

  test("union", () => {
    expect(
      union([
        new Set([0, 1, 2, 3]),
        new Set([1, 2, 3, 4]),
        new Set([2, 3, 4, 5]),
      ]),
    ).toStrictEqual(new Set([0, 1, 2, 3, 4, 5]));
  });
}
