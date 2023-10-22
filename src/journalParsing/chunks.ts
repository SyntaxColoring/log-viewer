/**
 * Lets you iterate over a stream's chunks using a `for await...of` loop.
 *
 * You should be able to do this natively, but browser support is poor at the moment.
 * https://caniuse.com/mdn-api_readablestream_--asynciterator
 */
export default async function* chunks<T>(
  stream: ReadableStream<T>,
): AsyncGenerator<T, void, void> {
  const reader = stream.getReader();
  for (
    let chunk = await reader.read();
    !chunk.done;
    chunk = await reader.read()
  ) {
    yield chunk.value;
  }
}
