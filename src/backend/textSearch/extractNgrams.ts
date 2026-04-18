export function extractNgrams(source: string, n: number): string[] {
  const result: string[] = [];
  for (let startIndex = 0; startIndex < source.length - n + 1; startIndex++) {
    result.push(source.slice(startIndex, startIndex + n));
  }
  return result;
}
