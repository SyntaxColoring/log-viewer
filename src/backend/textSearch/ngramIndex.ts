import { PostingList } from "../postingList";
import { intersect } from "../setUtils";
import { extractNgrams } from "./extractNgrams";

export class NgramIndex {
  // Keys are n-gram strings.
  // Values are the document IDs (log entry numbers) containing that n-gram.
  private readonly index: Map<string, PostingList>;

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

  /**
   * Returns the document IDs that MIGHT contain the given search text.
   * If the given search text is too short to be supported by this index,
   * returns null.
   */
  search(searchText: string): number[] | null {
    const uniqueSearchNgrams = [...new Set(extractNgrams(searchText, this.n))];
    if (uniqueSearchNgrams.length > 0) {
      const containingDocumentsPerNgram = uniqueSearchNgrams.map(
        (ngram) => new Set(this.index.get(ngram) ?? []),
      );
      const documentsContainingAllNgrams = intersect(
        containingDocumentsPerNgram,
      );
      return [...documentsContainingAllNgrams];
    } else {
      return null;
    }
  }

  private registerNgram(ngram: string, documentID: number): void {
    const existingPostingList = this.index.get(ngram);
    if (existingPostingList === undefined) {
      const postingList = new PostingList();
      postingList.appendEntryNumber(documentID);
      this.index.set(ngram, postingList);
    } else {
      existingPostingList.appendEntryNumber(documentID);
    }
  }
}
