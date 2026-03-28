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
