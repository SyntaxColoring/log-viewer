import { normalize } from "./normalize";

/**
 * Returns the start indices of all instances of `query` within `text`.
 *
 * This is currently a plain substring search.
 */
export function* findAllMatches(text: string, query: string): Generator<number, void, void> {
    let normalizedText = normalize(text)
    const normalizedQuery = normalize(query)

    if (normalizedQuery !== "") {
        let searchStartIndex = 0;
        while (true) {
            const matchIndex = normalizedText.indexOf(query, searchStartIndex)
            if (matchIndex === -1) return
            else {
                yield matchIndex
                searchStartIndex = matchIndex + query.length
            }
        }
    }
}
