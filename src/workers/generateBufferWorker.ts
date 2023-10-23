import { expose } from "comlink";

const obj = {
  generateBuffer: (size: number): SharedArrayBuffer => {
    console.log("generateBuffer() in worker start", Date.now());
    const buffer = new SharedArrayBuffer(size);
    const uint8Array = new Uint8Array(buffer);
    for (let i = 0; i < size; i++) {
      uint8Array[i] = i % 10;
    }
    console.log("generateBuffer() in worker end", Date.now());
    return buffer;
  },
};

expose(obj);
