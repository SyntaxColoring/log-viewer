/**
 * Create readable streams to use in tests.
 *
 * The returned streams all return the same `data`, but they have different ways of splitting it
 * across chunks. This is intended to expose bugs in consumers' chunk-handling logic.
 */
export function testReadables(
  data: Uint8Array,
): { label: string; readableStream: ReadableStream<Uint8Array> }[] {
  return [
    {
      label: "single chunk",
      readableStream: new ReadableStream({
        start: (controller) => {
          controller.enqueue(data);
          controller.close();
        },
      }),
    },
    {
      label: "one chunk per byte",
      readableStream: new ReadableStream({
        start: (controller) => {
          for (const byte of data) controller.enqueue(new Uint8Array([byte]));
          controller.close();
        },
      }),
    },
    // Some other interesting chunking strategies we might want to try:
    // * 0-sized chunks?
    // * 2 chunks, with a sweeping transition point?
  ];
}
