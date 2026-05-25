/**
 * A set of entry numbers, stored as a compressed array of integers.
 */
export class PostingList {
  #bytes: Uint8Array;
  #populatedByteLength: number;
  #lastEntryNumber: number;

  constructor() {
    this.#bytes = new Uint8Array(1);
    this.#populatedByteLength = 0;
    this.#lastEntryNumber = 0;
  }

  appendEntryNumber(entryNumber: number) {
    if (
      entryNumber < 0 ||
      entryNumber > 0b00111111_11111111_11111111_11111111 // Max of a uint32 with 2 bits reserved for the length tag.
    ) {
      throw new Error("entryNumber out of range.");
    } else if (entryNumber < this.#lastEntryNumber) {
      throw new Error("entryNumber not monotonically increasing.");
    } else {
      // Encoding: [2-bit length tag] [MSB] ... [LSB]

      const delta = entryNumber - this.#lastEntryNumber;
      const byte0 = (delta & 0xff000000) >>> 24;
      const byte1 = (delta & 0x00ff0000) >>> 16;
      const byte2 = (delta & 0x0000ff00) >>> 8;
      const byte3 = (delta & 0x000000ff) >>> 0;

      if (delta & 0b11111111_11000000_00000000_00000000) {
        // 4-byte encoding.
        const tag = 0b11 << 6;
        this.#appendBytes([tag | byte0, byte1, byte2, byte3]);
      } else if (delta & 0b11111111_11111111_11000000_00000000) {
        // 3-byte encoding.
        const tag = 0b10 << 6;
        this.#appendBytes([tag | byte1, byte2, byte3]);
      } else if (delta & 0b11111111_11111111_11111111_11000000) {
        // 2-byte encoding.
        const tag = 0b01 << 6;
        this.#appendBytes([tag | byte2, byte3]);
      } else {
        // 1-byte encoding.
        const tag = 0b00 << 6;
        this.#appendBytes([tag | byte3]);
      }
      this.#lastEntryNumber = entryNumber;
    }
  }

  #appendBytes(bytesToAppend: number[]): void {
    this.#ensureCapacity(this.#populatedByteLength + bytesToAppend.length);
    this.#bytes.set(bytesToAppend, this.#populatedByteLength);
    this.#populatedByteLength += bytesToAppend.length;
  }

  #ensureCapacity(desiredCapacity: number): void {
    while (this.#bytes.byteLength < desiredCapacity) {
      const newBytes = new Uint8Array(this.#bytes.byteLength * 2);
      newBytes.set(this.#bytes);
      this.#bytes = newBytes;
    }
  }

  // Returns [delta, consumedByteCount].
  #decodeDelta(startingByteIndex: number): [number, number] {
    const sizeCode = (this.#bytes[startingByteIndex] >>> 6) & 0b11;
    if (sizeCode === 0b00) {
      // 1-byte encoding.
      const byte0 = this.#bytes[startingByteIndex + 0] & 0b00111111;
      const delta = byte0 << 0;
      return [delta, 1];
    } else if (sizeCode === 0b01) {
      // 2-byte encoding.
      const byte0 = this.#bytes[startingByteIndex + 0] & 0b00111111;
      const byte1 = this.#bytes[startingByteIndex + 1];
      const delta = (byte0 << 8) | (byte1 << 0);
      return [delta, 2];
    } else if (sizeCode === 0b10) {
      // 3-byte encoding.
      const byte0 = this.#bytes[startingByteIndex + 0] & 0b00111111;
      const byte1 = this.#bytes[startingByteIndex + 1];
      const byte2 = this.#bytes[startingByteIndex + 2];
      const delta = (byte0 << 16) | (byte1 << 8) | (byte2 << 0);
      return [delta, 3];
    } else {
      // 4-byte encoding.
      const byte0 = this.#bytes[startingByteIndex + 0] & 0b00111111;
      const byte1 = this.#bytes[startingByteIndex + 1];
      const byte2 = this.#bytes[startingByteIndex + 2];
      const byte3 = this.#bytes[startingByteIndex + 3];
      const delta = (byte0 << 24) | (byte1 << 16) | (byte2 << 8) | (byte3 << 0);
      return [delta, 4];
    }
  }

  *[Symbol.iterator](): Iterator<number> {
    let previousEntryNumber = 0;
    let byteOffset = 0;
    while (byteOffset < this.#populatedByteLength) {
      const [delta, consumedBytes] = this.#decodeDelta(byteOffset);
      const entryNumber = previousEntryNumber + delta;
      yield entryNumber;
      previousEntryNumber = entryNumber;
      byteOffset += consumedBytes;
    }
  }
}

if (import.meta.vitest) {
  const { expect, it } = import.meta.vitest;

  it("round-trips entry numbers", () => {
    const postingList = new PostingList();
    const entries = [
      1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800,
      479001600,
    ];
    for (const entryNumber of entries) {
      postingList.appendEntryNumber(entryNumber);
    }
    expect([...postingList]).toStrictEqual(entries);
  });

  it("returns an empty array when no entry numbers have been added", () => {
    const postingList = new PostingList();
    expect([...postingList]).toStrictEqual([]);
  });

  it("rejects entry numbers below 0", () => {
    const postingList = new PostingList();
    expect(() => postingList.appendEntryNumber(-1)).toThrow(
      "entryNumber out of range.",
    );
  });

  it("rejects entry numbers that are too large", () => {
    const postingList = new PostingList();
    const expectedMaximum = 0b00111111_11111111_11111111_11111111;
    postingList.appendEntryNumber(expectedMaximum); // Should not throw.
    expect(() => postingList.appendEntryNumber(expectedMaximum + 1)).toThrow(
      "entryNumber out of range.",
    );
  });

  it("rejects entry numbers that are not monotonically increasing", () => {
    const postingList = new PostingList();
    postingList.appendEntryNumber(10);
    expect(() => postingList.appendEntryNumber(9)).toThrow(
      "entryNumber not monotonically increasing.",
    );
  });
}
