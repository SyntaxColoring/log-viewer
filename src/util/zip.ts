export function zip<A, B>(as: A[], bs: B[]): Array<[A, B]> {
  const length = Math.min(as.length, bs.length);
  const result: Array<[A, B]> = [];
  for (let i = 0; i < length; ++i) {
    result.push([as[i], bs[i]]);
  }
  return result;
}
