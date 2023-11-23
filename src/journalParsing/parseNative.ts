import chunks from "./chunks";

const EQUALS = "=".charCodeAt(0);
const NEWLINE = "\n".charCodeAt(0);

export type NativeParseEvent =
  | { type: "field"; name: string; value: string }
  | { type: "entryComplete" };

export default async function* parseNativeFile(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<NativeParseEvent, void, void> {
  const byteIterator = bytes(stream);

  // @ts-expect-error Hack because I don't know idiomatic JS and I want to reuse the generator across loops.
  // https://stackoverflow.com/a/70298180/497934
  byteIterator.return = undefined;

  while (true) {
    // TODO: Figure out termination condition.
    // TODO: We should consider the possibility that there is nothing to read here.
    // e.g. if the file is empty, or if
    const readFieldNameResult = await readFieldName(byteIterator);

    if (readFieldNameResult === "gracefulEOF") {
      break;
    } else {
      const { fieldName, termination: fieldNameTermination } =
        readFieldNameResult;

      if (fieldName === "" && fieldNameTermination === NEWLINE) {
        // We just read a blank line entry separator.
        yield { type: "entryComplete" };
      } else if (fieldNameTermination === EQUALS) {
        // TODO: Ideally, we want to skip the entire field value if it's not one that we care about.
        const fieldValue = await readFieldTextValue(byteIterator);
        yield { type: "field", name: fieldName, value: fieldValue };
      } else {
        const fieldSize = await readSize(byteIterator);
        // TODO: Ideally, we want to skip the entire field value if it's not one that we care about.
        const fieldValue = await readSizedValue(byteIterator, fieldSize);
        await readNewline(byteIterator);
        yield { type: "field", name: fieldName, value: fieldValue };
      }
    }
  }
}

async function* bytes(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<number, void, void> {
  for await (const chunk of chunks(stream.getReader())) {
    for (const byte of chunk) {
      yield byte;
    }
  }
}

async function readSize(bytes: AsyncIterator<number>): Promise<number> {
  let result = 0;
  for (let index = 0; index < 8; index++) {
    const next = await bytes.next();
    if (next.done)
      throw new ParseError("Reached end of file while reading size.");
    result += next.value * 256 ** index;
  }
  return result;
}

async function readSizedValue(
  bytes: AsyncIterator<number>,
  size: number,
): Promise<string> {
  const result = new Uint8Array(size);
  // TODO: Ideally, this would be zero-copy.
  for (let index = 0; index < size; index++) {
    const next = await bytes.next();
    if (next.done)
      throw new ParseError("Reached end of file while reading sized value.");
    result[index] = next.value;
  }

  const decoder = new TextDecoder();
  // TODO: This is probably not safe in general.  We probably want to always return bytes.
  // Leave it up to the caller to translate to strings.
  return decoder.decode(result);
}

async function readNewline(bytes: AsyncIterator<number>): Promise<void> {
  const result = await bytes.next();
  if (result.done)
    throw new ParseError("Reached end of file while expecting newline.");
  if (result.value != NEWLINE)
    throw new ParseError(`Expected newline, got ${result.value}.`);
}

async function readFieldName(
  bytes: AsyncIterable<number>,
): Promise<
  | "gracefulEOF"
  | { fieldName: string; termination: typeof EQUALS | typeof NEWLINE }
> {
  const bytesToDecode: number[] = [];

  for await (const byte of bytes) {
    if (byte === EQUALS || byte === NEWLINE) {
      // As far as I can tell, the encoding of field names is unspecified.
      // It's probably ASCII or UTF-8. Let's assume it's UTF-8.
      const decoder = new TextDecoder();
      const fieldName = decoder.decode(Uint8Array.from(bytesToDecode));
      return { fieldName, termination: byte };
    } else {
      // TODO: This is going to allocate a new single-element Uint8Array for every byte we
      // read from the source stream. We need to change this to pass slices from the source
      // to the decoder without copying them.
      bytesToDecode.push(byte);
    }
  }

  // Reached EOF.
  if (bytesToDecode.length > 0) {
    throw new ParseError("Reached end of file while reading field name.");
  } else {
    // Didn't read anything at all.
    return "gracefulEOF";
  }
}

async function readFieldTextValue(
  bytes: AsyncIterable<number>,
): Promise<string> {
  const bytesToDecode: number[] = [];

  // TODO: We probably want to deduplicate this into some kind of readUntil helper.
  for await (const byte of bytes) {
    if (byte === NEWLINE) {
      const decoder = new TextDecoder();
      const value = decoder.decode(Uint8Array.from(bytesToDecode));
      return value;
    } else {
      bytesToDecode.push(byte);
    }
  }

  throw new ParseError("Reached end of file while reading field text value.");
}

class ParseError extends Error {}
