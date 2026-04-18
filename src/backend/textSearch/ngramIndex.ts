import { intersect } from "../setUtils";
import { extractNgrams } from "./extractNgrams";

// TODO: T needs to be non-null, non-undefined, and support equality comparisons.
// See if this can be enforced statically.
export class NgramIndex<T> {
  // Keys are n-gram strings.
  // Values are the IDs of documents containing that n-gram.
  private readonly index: Map<string, Set<T>>;

  private readonly n: number;

  constructor(n: number) {
    this.index = new Map();
    this.n = n;
  }

  addDocument(documentID: T, source: string): void {
    const ngrams = extractNgrams(source, this.n);
    const uniqueNgrams = new Set(ngrams);
    for (const ngram of uniqueNgrams) {
      this.registerNgram(ngram, documentID);
    }
  }

  /**
   * Returns the document IDs that MIGHT contain the given search text.
   * If the given search text is too short to be supported by this index,
   * returns null.
   */
  search(searchText: string): T[] | null {
    const uniqueSearchNgrams = [...new Set(extractNgrams(searchText, this.n))];
    if (uniqueSearchNgrams.length > 0) {
      const containingDocumentsPerNgram = uniqueSearchNgrams.map(
        (ngram) => this.index.get(ngram) ?? new Set<T>(),
      );
      const documentsContainingAllNgrams = intersect(
        containingDocumentsPerNgram,
      );
      return [...documentsContainingAllNgrams];
    } else {
      return null;
    }
  }

  private registerNgram(ngram: string, documentID: T): void {
    const existingSet = this.index.get(ngram);
    if (existingSet === undefined) this.index.set(ngram, new Set([documentID]));
    else existingSet.add(documentID);
  }
}
