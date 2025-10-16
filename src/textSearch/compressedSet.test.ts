import { expect, it } from "vitest";

import { CompressedSet } from "./compressedSet";

it("implements an encode/decode round trip", () => {
    // Just an arbitrary big number.
    const count = 3000;

    const subject = new CompressedSet(100)

    const input: number[] = [123];
    for (let i = 0; i < count; i++) {
        const difference = Math.floor(Math.random()*10000) + 1;
        const newElement = input.at(-1)! + difference;
        input.push(newElement)
    }

    for (const inputElement of input) {
        subject.append(inputElement)
    }

    const output = [...subject];

    expect(output).toStrictEqual(input);
});
