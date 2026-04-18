import { makeIntervalYielder } from "event-loop-yielder";

import chunks from "./journalParsing/chunks";
import jsonRecordSplitter, {
  type ParsedJSON,
} from "./journalParsing/jsonRecordSplitter";
import {
  BINARY_DATA_PLACEHOLDER,
  getValidatedFields,
  type LogEntry,
} from "./logEntry";
import { NgramIndex } from "./textSearch/ngramIndex";
import { normalize } from "./textSearch/normalize";

const YIELD_INTERVAL = 1000 / 60;

/** An interface for searching a log file. */
export interface LogSearcher {
  /** The total number of entries in the log file. */
  entryCount: number;

  /**
   * Searches for entries matching the given filters.
   * Returns the matching entry numbers.
   */
  search: (
    params: SearchParams,
    abortSignal?: AbortSignal,
  ) => Promise<number[]>;

  /** Returns the full contents of the given entries. */
  getEntries: (entryNumbers: number[]) => Promise<LogEntry[]>;
}

export interface SearchParams {
  /**
   * If null, do not filter based on substring (return all entries).
   * If non-null, filter entries whose normalized message includes this substring.
   */
  substring: string | null;
  // TODO: Also allow filtering by unit, priority, etc.
}

interface ByteRange {
  beginByteIndex: number;
  endByteIndex: number;
}

export async function buildLogSearcher(
  file: File,
  onProgress?: (progress0To1: number) => void,
): Promise<LogSearcher> {
  const textSearchIndex = new NgramIndex<number>(3);
  const byteRanges: ByteRange[] = [];

  const maybeYieldToEventLoop = makeIntervalYielder(YIELD_INTERVAL);

  console.log(`Reading ${file.size} bytes...`);

  const entryStream = file.stream().pipeThrough(jsonRecordSplitter());

  for await (const entry of chunks(entryStream.getReader())) {
    const newEntryNumber = byteRanges.length;
    const parsedEntry = parseEntry(entry);

    byteRanges.push({
      beginByteIndex: entry.beginByteIndex,
      endByteIndex: entry.endByteIndex,
    });
    textSearchIndex.addDocument(
      newEntryNumber,
      normalize(parsedEntry.validatedFields.message),
    );

    if (newEntryNumber % 10000 === 0) {
      onProgress?.(entry.endByteIndex / file.size);
      await maybeYieldToEventLoop();
    }
  }

  console.log(
    `Done reading ${byteRanges.length} entries from ${file.size} bytes.`,
  );

  const getEntry = async (entryNumber: number): Promise<LogEntry> => {
    const byteRangeForEntry = byteRanges[entryNumber];
    const byteStreamForEntry = file.slice(
      byteRangeForEntry.beginByteIndex,
      byteRangeForEntry.endByteIndex,
    );
    // TODO: This stream stuff is a lot of overhead for reading a single entry.
    const entryReader = byteStreamForEntry
      .stream()
      .pipeThrough(jsonRecordSplitter())
      .getReader();
    const readResult = await entryReader.read();
    if (readResult.value === undefined) {
      throw new Error(
        `Failed to read entry at byte range: ${byteRangeForEntry.beginByteIndex}, ${byteRangeForEntry.endByteIndex}`,
      );
    }
    const parsed = parseEntry(readResult.value);
    return { entryNumber, ...parsed };
  };

  const getEntries = async (entryNumbers: number[]): Promise<LogEntry[]> => {
    const result: LogEntry[] = [];
    for (const entryNumber of entryNumbers) {
      result.push(await getEntry(entryNumber));
    }
    return result;
  };

  const search = async (
    params: SearchParams,
    abortSignal?: AbortSignal,
  ): Promise<number[]> => {
    if (params.substring === null) {
      const allEntryNumbers = byteRanges.map((_, i) => i);
      return allEntryNumbers;
    }

    // TODO: This call to textSearchIndex.search() can be slow. Run it in a WebWorker.
    const candidateEntryNumbers = textSearchIndex.search(
      normalize(params.substring),
    );
    const matchingEntryNumbers: number[] = [];
    for (let i = 0; i < candidateEntryNumbers.length; i++) {
      abortSignal?.throwIfAborted();

      const candidateNumber = candidateEntryNumbers[i];
      const candidate = await getEntry(candidateNumber);

      if (
        normalize(candidate.validatedFields.message).includes(
          normalize(params.substring),
        )
      )
        matchingEntryNumbers.push(candidateNumber);
    }

    abortSignal?.throwIfAborted();

    return matchingEntryNumbers;
  };

  return {
    entryCount: byteRanges.length,
    search,
    getEntries,
  };
}

function parseEntry(parsed: ParsedJSON): Omit<LogEntry, "entryNumber"> {
  const rawFields = toRawFields(parsed.parsedJSON);
  return {
    rawFields,
    validatedFields: getValidatedFields(rawFields),
  };
}

function toRawFields(parsedJSON: unknown): Map<string, string> {
  if (
    typeof parsedJSON !== "object" ||
    parsedJSON === null ||
    Array.isArray(parsedJSON)
  ) {
    return new Map();
  }

  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(parsedJSON)) {
    if (typeof value === "string") {
      result.set(key, value);
    } else if (Array.isArray(value)) {
      // journalctl encodes binary data as JSON arrays of numbers.
      result.set(key, BINARY_DATA_PLACEHOLDER);
    }
  }
  return result;
}
