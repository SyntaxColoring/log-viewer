// Our code expects a browser environment where web APIs like TextDecoder
// are available in the global scope. Our tests run in Node, which does have those
// APIs, but only if you import them explicitly. JSDOM normally makes our Node
// test environment look like a browser, but it looks like it's missing some APIs.
// So, here, we put those APIs in the global scope ourselves.

import {
  TransformStream as NodeTransformStream,
  ReadableStream as NodeReadableStream,
} from "node:stream/web";
import { TextDecoder as NodeTextDecoder } from "node:util";

// I don't understand these type errors.
// I guess there are slight incompatibilities between Node's APIs and the browser's?
// @ts-expect-error
globalThis.TextDecoder = NodeTextDecoder;
// @ts-expect-error
globalThis.TransformStream = NodeTransformStream;
// @ts-expect-error
globalThis.ReadableStream = NodeReadableStream;
