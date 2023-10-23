import { wrap } from "comlink";

export async function generateBuffer(size: number): Promise<SharedArrayBuffer> {
  console.log("generateBuffer() wrapper start");

  // Magic syntax from https://webpack.js.org/guides/web-workers/.
  /* webpackChunkName: "foo-worker" */ const worker = new Worker(
    new URL("./generateBufferWorker.ts", import.meta.url),
  );

  const obj = wrap(worker);
  // @ts-expect-error
  const result = await obj.generateBuffer(size);

  // TODO: Handle cancellation

  console.log("generateBuffer() wrapper end, returning:", result);
  return result;
}
