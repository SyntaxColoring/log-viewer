import { describe, expect, test } from "vitest";

import chunks from "./chunks";
import jsonRecordSplitter from "./jsonRecordSplitter";
import { testReadables } from "./testReadable";

const testData = [
  {
    simpleField1: "abc",
    simpleField2: "def",
  },
  {
    omitted: null,
    binary: [1, 2, 3, 4, 5, 6],
  },
  {
    multipleValues: ["abc", "def", null, [1, 2, 3, 4, 5, 6]],
  },
  {
    containsJSONCharacters: "{}[],:",
  },
];

describe("journalctl --output=json", () => {
  describe.each([{ trailingNewline: true }, { trailingNewline: false }])(
    "%p",
    ({ trailingNewline }) => {
      let inputString = testData.map((o) => JSON.stringify(o)).join("\n");
      if (trailingNewline) inputString += "\n";
      const inputBytes = new TextEncoder().encode(inputString);
      const inputReadableStreams = testReadables(inputBytes);

      test.each(inputReadableStreams)(
        "$label",
        async ({ readableStream: sourceReadable }) => {
          const subject = jsonRecordSplitter();
          const result = await allChunks(
            sourceReadable.pipeThrough(subject).getReader(),
          );

          expect(result.map((v) => v.parsedJSON)).toStrictEqual(testData);

          const individuallyRereadResults = [];
          for (const resultEntry of result) {
            const source = new Blob([
              inputBytes.slice(
                resultEntry.beginByteIndex,
                resultEntry.endByteIndex,
              ),
            ]).stream();
            const individualSubject = jsonRecordSplitter();
            const individualReader = source
              .pipeThrough(individualSubject)
              .getReader();
            const [individuallyRereadResult] =
              await allChunks(individualReader);
            individuallyRereadResults.push(individuallyRereadResult);
          }

          expect(
            individuallyRereadResults.map((v) => v.parsedJSON),
          ).toStrictEqual(testData);
        },
      );
    },
  );
});

async function allChunks<T>(
  reader: ReadableStreamDefaultReader<T>,
): Promise<T[]> {
  const result = [];
  for await (const chunk of chunks(reader)) result.push(chunk);
  return result;
}
