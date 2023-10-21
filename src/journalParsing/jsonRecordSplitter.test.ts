import { TransformStream } from "node:stream/web";
import { TextDecoder, TextEncoder } from "node:util";

import chunks from "./chunks";
import jsonRecordSplitter, { ParsedJSON } from "./jsonRecordSplitter";

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

beforeAll(() => {
  global.TransformStream = TransformStream; // TODO: This seems like a hack?
  global.TextDecoder = TextDecoder;
});

test.each([{ trailingNewline: true }, { trailingNewline: false }])(
  "journalctl --output=json",
  async ({ trailingNewline }) => {
    let inputString = testData.map((o) => JSON.stringify(o)).join("\n");
    if (trailingNewline) inputString += "\n";
    const input = new TextEncoder().encode(inputString);

    const subject = jsonRecordSplitter();
    const writer = subject.writable.getWriter();
    const reader = subject.readable.getReader();

    const write = async () => {
      await writer.write(input);
      await writer.close();
    };

    const readAll = async () => {
      const results: ParsedJSON[] = [];
      for await (const result of chunks(reader)) {
        results.push(result);
      }
      return results;
    };

    const [_, readResult] = await Promise.all([write(), readAll()]);

    expect(readResult.map((v) => v.parsedJSON)).toStrictEqual(testData);

    const individuallyRereadResults = await Promise.all(
      readResult.map(async (v) => {
        const individualSubject = jsonRecordSplitter();
        const individualWriter = individualSubject.writable.getWriter();
        const individualReader = individualSubject.readable.getReader();

        const write = async () => {
          await individualWriter.write(
            input.slice(v.beginByteIndex, v.endByteIndex),
          );
          await individualWriter.close();
        };

        const readAll = async () => {
          const results: ParsedJSON[] = [];
          for await (const result of chunks(individualReader)) {
            results.push(result);
          }
          return results;
        };

        const [_, [individualReadResult]] = await Promise.all([
          write(),
          readAll(),
        ]);

        return individualReadResult;
      }),
    );

    expect(individuallyRereadResults.map((e) => e.parsedJSON)).toStrictEqual(
      testData,
    );
  },
);
