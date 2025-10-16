import { CompressedSet } from "./compressedSet";
import { extractNgrams } from "./extractNgrams";

const BLOCK_SIZE_BYTES = 1024;

export class NgramIndex {
  // Keys are n-gram strings.
  // Values are the IDs of documents containing that n-gram.
  private readonly index: Map<string, CompressedSet>;

  private readonly n: number;

  constructor(n: number) {
    this.index = new Map();
    this.n = n;
  }

  addDocument(documentID: number, source: string): void {
    const ngrams = extractNgrams(source, this.n);
    const uniqueNgrams = new Set(ngrams);
    for (const ngram of uniqueNgrams) {
      this.registerNgram(ngram, documentID);
    }
  }

  search(searchText: string): number[] {
    const uniqueSearchNgrams = [...new Set(extractNgrams(searchText, this.n))];
    const containingDocumentsPerNgram = uniqueSearchNgrams.map(
      (ngram) => this.index.get(ngram) ?? [],
    );
    const documentsContainingAllNgrams = intersect(containingDocumentsPerNgram);
    return [...documentsContainingAllNgrams];
  }

  private registerNgram(ngram: string, documentID: number) {
    const existingSet = this.index.get(ngram);
    if (existingSet === undefined) {
      const newSet = new CompressedSet(BLOCK_SIZE_BYTES);
      newSet.append(documentID);
      this.index.set(ngram, newSet);
    } else existingSet.append(documentID);
  }
}

function intersect(sets: Array<CompressedSet | number[]>): Set<number> {
  // Optimization: query the sets with fewest elements first,
  // assuming they're most likely to be missing elements from other sets.
  const sortedSets = sets.slice().sort((s) => s.length);

  if (sortedSets.length > 0) {
    const intersection = sortedSets.reduce(
      (
        previous: CompressedSet | number[] | Set<number>,
        next: CompressedSet | number[],
      ): Set<number> => {
        const intersectionOfPair = new Set<number>();
        const decompressedNext = new Set(next);
        for (const element of previous) {
          if (decompressedNext.has(element)) {
            intersectionOfPair.add(element);
          }
        }
        return intersectionOfPair;
      },
    );
    return intersection;
  }
  return new Set();
}
