import { TransformStream } from "node:stream/web";
import chunks from "./chunks";
import jsonRecordSplitter from "./jsonRecordSplitter";

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
});

test.each([{ trailingNewline: true }, { trailingNewline: false }])(
  "journalctl --output=json",
  async ({ trailingNewline }) => {
    let input = testData.map((o) => JSON.stringify(o)).join("\n");
    if (trailingNewline) input += "\n";

    const subject = jsonRecordSplitter();
    const writer = subject.writable.getWriter();
    const reader = subject.readable.getReader();

    const write = async () => {
      await writer.write(input);
      await writer.close();
    };

    const readAll = async () => {
      const results: object[] = [];
      for await (const result of chunks(reader)) {
        results.push(result);
      }
      return results;
    };

    const [_, readResult] = await Promise.allSettled([write(), readAll()]);
    expect(readResult).toStrictEqual({ status: "fulfilled", value: testData });
  },
);
