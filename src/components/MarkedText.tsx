import { findAllMatches } from "../textSearch/query";

import "./MarkedText.css";

import { type JSX } from "react";

/**
 * Renders the bare `text`, with the matching parts wrapped in `<mark>`.
 **/
export default function MarkedText({
  text,
  query,
  // TODO: MarkedText doesn't have to know about the active row.
  // We could implement this with CSS selectors alone.
  isActive,
}: {
  text: string;
  query: string;
  isActive: boolean;
}): JSX.Element {
  const chunks = [...sliceChunks(text, query)];
  return (
    <>
      {chunks.map(({ text, isMatch }) =>
        isMatch ? (
          <mark className={isActive ? "mark active" : "mark"}>{text}</mark>
        ) : (
          text
        ),
      )}
    </>
  );
}

interface Chunk {
  text: string;
  isMatch: boolean;
}

function* sliceChunks(
  text: string,
  query: string,
): Generator<Chunk, void, void> {
  let previousMatchIndex: number | null = null;
  for (const matchIndex of findAllMatches(text, query)) {
    // Yield the non-match that came before this match.
    const nonMatchBegin =
      previousMatchIndex === null ? 0 : previousMatchIndex + query.length;
    const nonMatchEnd = matchIndex;
    yield {
      text: text.slice(nonMatchBegin, nonMatchEnd),
      isMatch: false,
    };

    // Yield this match.
    yield {
      // We need to slice from text instead of just using query because the capitalization
      // of the query doesn't necessarily match the capitalization in the original text.
      text: text.slice(matchIndex, matchIndex + query.length),
      isMatch: true,
    };

    previousMatchIndex = matchIndex;
  }

  // Yield the final non-match that came after the last match.
  const nonMatchBegin =
    previousMatchIndex === null ? 0 : previousMatchIndex + query.length;
  yield {
    text: text.slice(nonMatchBegin),
    isMatch: false,
  };
}
