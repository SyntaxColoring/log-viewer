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
