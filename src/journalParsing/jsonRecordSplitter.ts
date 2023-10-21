export default function jsonRecordSplitter(): TransformStream<string, object> {
  const { writable, readable } = lineSplitter();
  return {
    writable,
    readable: readable.pipeThrough(jsonRecordParser()),
  };
}

/**
 * A transform stream that splits the input on `\n` characters.
 * Each emitted chunk is a complete line, without its trailing `\n`.
 */
function lineSplitter(): TransformStream<string, string> {
  let textSinceLastNewline = "";

  return new TransformStream({
    transform(
      chunk: string,
      controller: TransformStreamDefaultController<string>,
    ): void {
      let splitChunk = chunk.split("\n");
      splitChunk[0] = textSinceLastNewline + splitChunk[0];

      const completedLines = splitChunk.slice(0, -1);
      const remainder = splitChunk.at(-1)!;

      for (const line of completedLines) {
        controller.enqueue(line);
      }
      textSinceLastNewline = remainder;
    },

    flush(controller: TransformStreamDefaultController<string>) {
      controller.enqueue(textSinceLastNewline);
    },
  });
}

/**
 * A transform stream that parses each input chunk as a JSON string and emits the parsed object
 * as an output chunk.
 *
 * Empty (`""`) input chunks are ignored. This allows the input to be optionally terminated with a
 * trailing newline.
 */
function jsonRecordParser(): TransformStream<string, object> {
  return new TransformStream({
    transform(
      chunk: string,
      controller: TransformStreamDefaultController<object>,
    ): void {
      if (chunk !== "") controller.enqueue(JSON.parse(chunk));
    },
  });
}
