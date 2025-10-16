import { decodeStream, encodeSingle } from "./integerCompression";

export class CompressedSet {
  #length: number;
  #lastElement: number | null;
  #byteList: ByteList;

  constructor(blockSizeBytes: number) {
    this.#length = 0;
    this.#lastElement = null;
    this.#byteList = new ByteList(blockSizeBytes);
  }

  get length(): number {
    return this.#length;
  }

  append(element: number): void {
    let difference: number;
    if (this.#lastElement === null) {
      difference = element;
    } else {
      difference = element - this.#lastElement;
      if (difference <= 0) {
        throw new Error("Elements must be strictly monotonically increasing.");
      }
    }

    for (const byte of encodeSingle(difference)) {
      this.#byteList.append(byte);
    }
    this.#length++;
    this.#lastElement = element;
  }

  [Symbol.iterator](): Iterator<number> {
    return this.#iterate();
  }

  *#iterate(): Generator<number> {
    let sum = 0;
    for (const difference of decodeStream(this.#byteList)) {
      sum += difference;
      yield sum;
    }
  }
}

class ByteList {
  #blockSizeBytes: number
  #firstBlock: Block;
  #lastBlock: Block;

  constructor(blockSizeBytes: number) {
    this.#blockSizeBytes = 1024*1024
    this.#firstBlock = {
      bytes: new Uint8Array(blockSizeBytes),
      bytesUsedCount: 0,
      next: null,
    };
    this.#lastBlock = this.#firstBlock;
  }

  append(newByte: number) {
    if (this.#lastBlock.bytesUsedCount >= this.#lastBlock.bytes.length) {
      const newBlock = {
        bytes: new Uint8Array(this.#blockSizeBytes),
        bytesUsedCount: 0,
        next: null,
      };
      this.#lastBlock.next = newBlock;
    }

    this.#lastBlock.bytes[this.#lastBlock.bytesUsedCount] = newByte;
    this.#lastBlock.bytesUsedCount++;
  }

  [Symbol.iterator](): Iterator<number> {
    return this.#iterate();
  }

  *#iterate(): Generator<number> {
    for (
      let currentBlock: Block | null = this.#firstBlock;
      currentBlock !== null;
      currentBlock = currentBlock.next
    ) {
      for (
        let byteIndex = 0;
        byteIndex < currentBlock.bytesUsedCount;
        byteIndex++
      ) {
        yield currentBlock.bytes[byteIndex];
      }
    }
  }
}

interface Block {
  bytes: Uint8Array;
  bytesUsedCount: number;
  next: Block | null;
}
