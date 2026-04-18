import * as arrayUtils from "./arrayUtils";

export default function jsonRecordSplitter(): TransformStream<
  Uint8Array,
  ParsedJSON
> {
  const { writable, readable } = lineSplitter();
  return {
    writable,
    readable: readable.pipeThrough(jsonRecordParser()),
  };
}

interface SplitLine {
  line: string;
  beginByteIndex: number;
  endByteIndex: number;
}

export interface ParsedJSON {
  parsedJSON: unknown;
  beginByteIndex: number;
  endByteIndex: number;
}

/**
 * A transform stream that splits the input on `\n` characters.
 * Each emitted chunk is a complete line, without its trailing `\n`.
 */
function lineSplitter(): TransformStream<Uint8Array, SplitLine> {
  let pendingLine: arrayUtils.SplitUint8ArrayResult = {
    begin: 0,
    end: 0,
    segment: new Uint8Array(),
  };

  let nextChunkOffset = 0;

  return new TransformStream({
    transform(
      chunk: Uint8Array,
      controller: TransformStreamDefaultController<SplitLine>,
    ): void {
      const splitChunk = arrayUtils
        .splitUint8Array(chunk, "\n".charCodeAt(0))
        .map((v) => ({
          ...v,
          begin: nextChunkOffset + v.begin,
          end: nextChunkOffset + v.end,
        }));

      splitChunk[0] = {
        begin: pendingLine.begin,
        end: splitChunk[0].end,
        segment: arrayUtils.concatUint8Array(
          pendingLine.segment,
          splitChunk[0].segment,
        ),
      };

      const completedLines = splitChunk.slice(0, -1);
      const remainder = splitChunk.at(-1)!;

      for (const line of completedLines) {
        controller.enqueue({
          line: new TextDecoder().decode(line.segment),
          beginByteIndex: line.begin,
          endByteIndex: line.end,
        });
      }
      pendingLine = remainder;
      nextChunkOffset += chunk.byteLength;
    },

    flush(controller: TransformStreamDefaultController<SplitLine>) {
      controller.enqueue({
        line: new TextDecoder().decode(pendingLine.segment),
        beginByteIndex: pendingLine.begin,
        endByteIndex: pendingLine.end,
      });
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
function jsonRecordParser(): TransformStream<SplitLine, ParsedJSON> {
  return new TransformStream({
    transform(
      chunk: SplitLine,
      controller: TransformStreamDefaultController<ParsedJSON>,
    ): void {
      if (chunk.line !== "") {
        controller.enqueue({
          beginByteIndex: chunk.beginByteIndex,
          endByteIndex: chunk.endByteIndex,
          parsedJSON: JSON.parse(chunk.line),
        });
      }
    },
  });
}
