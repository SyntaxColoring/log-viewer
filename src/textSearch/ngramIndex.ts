import { extractNgrams } from "./extractNgrams"

// TODO: T needs to be non-null, non-undefined, and support equality comparisons.
// See if this can be enforced statically.
export class NgramIndex<T> {
    // Keys are n-gram strings.
    // Values are the IDs of documents containing that n-gram.
    private readonly index: Map<string, Set<T>>

    private readonly n: number

    constructor(n: number) {
        this.index = new Map()
        this.n = n
    }

    addDocument(documentID: T, source: string): void {
        const ngrams = extractNgrams(source, this.n)
        const uniqueNgrams = new Set(ngrams)
        for (const ngram of uniqueNgrams) {
            this.registerNgram(ngram, documentID)
        }

    }

    search(searchText: string): T[] {
        const uniqueSearchNgrams = [...new Set(extractNgrams(searchText, this.n))]
        const containingDocumentsPerNgram = uniqueSearchNgrams.map((ngram) =>
            this.index.get(ngram) ?? new Set<T>()
        )
        console.log("containingDocumentsPerNgram", containingDocumentsPerNgram)
        console.log("uniqueSearchNgrams", uniqueSearchNgrams)
        console.log("index", this.index)
        const documentsContainingAllNgrams = intersect(containingDocumentsPerNgram)
        return [...documentsContainingAllNgrams]
    }

    private registerNgram(ngram: string, documentID: T) {
        const existingSet = this.index.get(ngram)
        if (existingSet === undefined) this.index.set(ngram, new Set([documentID]))
        else existingSet.add(documentID)

    }
}

function intersect<T>(sets: Set<T>[]): Set<T> {
    const result = new Set<T>()

    if (sets.length > 0) {
        // Optimization: query the sets with fewest elements first,
        // assuming they're most likely to be missing elements from other sets.
        const sortedSets = sets.slice().sort((s) => s.size)
        const firstSet = sortedSets[0]
        const otherSets = sortedSets.slice(1)

        for (const element of firstSet) {
            const elementInAllSets = lazyAll(lazyMap(otherSets, (otherSet) => otherSet.has(element)))
            if (elementInAllSets) result.add(element)
        }
    }

    return result
}

function* lazyMap<I, O>(iterable: Iterable<I>, map: (element: I) => O): Generator<O> {
    for (const element of iterable) {
        yield map(element)
    }
}

// Returns whether all elements of iterable are true, bailing out early if any is false.
function lazyAll(iterable: Iterable<boolean>): boolean {
    for (const element of iterable) {
        if (!element) return false
    }
    return true
}
