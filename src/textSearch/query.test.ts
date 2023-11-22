import { expect, it } from "vitest";

import { findAllMatches } from "./query";

it("Finds all matches", () => {
  expect([...findAllMatches("Hello, world!", "l")]).toEqual([2, 3, 10]);
  expect([...findAllMatches("Hello, world!", "L")]).toEqual([2, 3, 10]);
  expect([...findAllMatches("HELLO, WORLD!", "l")]).toEqual([2, 3, 10]);
  expect([...findAllMatches("sassafras", "as")]).toEqual([1, 7]);
});
