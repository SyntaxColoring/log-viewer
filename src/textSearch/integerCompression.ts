const INT31_MAX = 0x7fffffff;
const INT7_MAX = 0x7f;

export function* encodeSingle(originalUint32: number) {
  if (
    !Number.isInteger(originalUint32) ||
    originalUint32 < 0 ||
    originalUint32 >= INT31_MAX
  ) {
    throw Error("Can't encode: " + originalUint32);
  }
  if (originalUint32 <= INT7_MAX) {
    yield originalUint32 << 1;
  } else {
    // We gotta be careful here because JS's bit shift operators act as if the
    // number is a 2's complement 32-bit signed integer.
    const payload0 = originalUint32 & 0x000000ff;
    const payload1 = (originalUint32 & 0x0000ff00) >> 8;
    const payload2 = (originalUint32 & 0x00ff0000) >> 16;
    const payload3 = (originalUint32 & 0x7f000000) >> 24;
    yield (payload0 << 1) | 1;
    yield (payload1 << 1) | (payload0 >> 7);
    yield (payload2 << 1) | (payload1 >> 7);
    yield (payload3 << 1) | (payload2 >> 7);
  }
}

export function* decodeStream(bytes: Iterable<number>): Generator<number> {
  let payloadSoFar: null | { nextIndex: number; payload: bigint } = null;
  for (const byte of bytes) {
    if (payloadSoFar === null) {
      const isContinued = byte & 1;
      if (isContinued) {
        payloadSoFar = {
          payload: BigInt(byte),
          nextIndex: 1,
        };
      } else {
        const assembledPayload = byte >> 1;
        yield assembledPayload;
      }
    } else {
      payloadSoFar.payload |=
        BigInt(byte) << BigInt(8 * payloadSoFar.nextIndex);
      payloadSoFar.nextIndex++;
      if (payloadSoFar.nextIndex >= 4) {
        const assembledPayload = Number(payloadSoFar.payload >> BigInt(1));
        payloadSoFar = null;
        yield assembledPayload;
      }
    }
  }
  if (payloadSoFar !== null) {
    throw Error("Unexpected EOF.");
  }
}
