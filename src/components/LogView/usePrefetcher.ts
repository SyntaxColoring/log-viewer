import { zip } from "@/util/zip";
import { useEffect, useMemo, useState } from "react";
import { clampRange, expandRange, type Range, rangeToArray } from "./ranges";

interface UsePrefetchForScroll<T> {
  /**
   * The total size of the list that's being scrolled through
   * (not just what's currently on-screen).
   */
  itemCount: number;

  /** The list indices that are currently on-screen. */
  indicesVisibleNow: number[];

  /** Load this many items beyond what's currently visible. */
  prefetchCount: number;

  /** Trigger a load when we get within this many items of the edge. */
  prefetchTriggerDistance: number;

  /** Fetch the actual data for some list items. */
  load: (indexes: number[]) => Promise<T[]>;
}

interface UsePrefetchForScrollResult<T> {
  /** The items that are currently loaded. Unloaded items will not be present. */
  loadedItems: Map<number, T>;
}

export function usePrefetchForScroll<T>(
  options: UsePrefetchForScroll<T>,
): UsePrefetchForScrollResult<T> {
  const {
    load,
    itemCount,
    indicesVisibleNow,
    prefetchCount,
    prefetchTriggerDistance,
  } = options;

  const [loadedItems, setLoadedItems] = useState<Map<number, T>>(new Map());

  const visibleRange = useMemo<Range>(() => {
    if (indicesVisibleNow.length === 0) return null;
    return {
      first: indicesVisibleNow.at(0)!,
      last: indicesVisibleNow.at(-1)!,
    };
  }, [indicesVisibleNow]);

  const targetRange = useMemo<Range>(() => {
    const loadedIndices = [...loadedItems.keys()].toSorted();
    const loadedRange: Range =
      loadedIndices.length === 0
        ? null
        : {
            first: loadedIndices.at(0)!,
            last: loadedIndices.at(-1)!,
          };

    return getTarget({
      loadedRange,
      visibleRange,
      totalRange: {
        first: 0,
        last: itemCount - 1,
      },
      prefetchCount,
      prefetchTriggerDistance,
    });
  }, [
    itemCount,
    loadedItems,
    prefetchCount,
    prefetchTriggerDistance,
    visibleRange,
  ]);

  // TODO: Rate-limit this.
  useEffect(() => {
    let ignore = false;

    const targetIndices = rangeToArray(targetRange);

    loadMissing(loadedItems, targetIndices, load)
      .then((newLoadedItems) => {
        if (!ignore) {
          setLoadedItems(newLoadedItems);
        }
      })
      .catch(() => {
        // TODO
      });

    return () => {
      ignore = true;
    };
  }, [targetRange, loadedItems, load]);

  return { loadedItems };
}

function getTarget(options: {
  loadedRange: Range;
  visibleRange: Range;
  totalRange: Range;
  prefetchCount: number;
  prefetchTriggerDistance: number;
}): Range {
  const {
    loadedRange,
    visibleRange,
    totalRange,
    prefetchCount,
    prefetchTriggerDistance,
  } = options;

  if (visibleRange === null) return loadedRange;
  if (loadedRange === null)
    return clampRange(expandRange(visibleRange, prefetchCount), totalRange);

  const nearTop =
    visibleRange.first - loadedRange.first < prefetchTriggerDistance;
  const nearBottom =
    loadedRange.last - visibleRange.last < prefetchTriggerDistance;
  if (nearTop || nearBottom)
    return clampRange(expandRange(visibleRange, prefetchCount), totalRange);

  return loadedRange;
}

async function loadMissing<T>(
  currentlyLoaded: Map<number, T>,
  targetIndices: number[],
  load: UsePrefetchForScroll<T>["load"],
): Promise<Map<number, T>> {
  // TODO: Clean this up with ranges, maybe.
  const isDifferent = targetIndices.some(index => !currentlyLoaded.has(index));
  if (!isDifferent) return currentlyLoaded;

  const missingIndices = targetIndices.filter(
    (index) => !currentlyLoaded.has(index),
  );
  const missingItems =
    missingIndices.length === 0 ? [] : await load(missingIndices);
  const missingItemsMap = new Map(zip(missingIndices, missingItems));

  const newLoaded = new Map(
    targetIndices.map((targetIndex) => {
      const fromCurrentlyLoaded = currentlyLoaded.get(targetIndex);
      const item =
        fromCurrentlyLoaded !== undefined
          ? fromCurrentlyLoaded
          : missingItemsMap.get(targetIndex)!;
      return [targetIndex, item];
    }),
  );

  return newLoaded;
}
