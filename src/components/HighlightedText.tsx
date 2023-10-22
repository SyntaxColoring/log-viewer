import { findAllMatches } from "../textSearch/query";

export function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}): JSX.Element {
  const chunks = [...sliceChunks(text, query)];
  return (
    <>
      {chunks.map(({ text, isMatch }) =>
        isMatch ? <mark>{text}</mark> : text,
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
