import { makeIntervalYielder } from "event-loop-yielder";

import { FieldValueIndex } from "./fieldValueIndex";
import chunks from "./journalParsing/chunks";
import jsonRecordSplitter, {
  type ParsedJSON,
} from "./journalParsing/jsonRecordSplitter";
import {
  BINARY_DATA_PLACEHOLDER,
  getValidatedFields,
  type LogEntry,
  type SyslogPriority,
} from "./logEntry";
import { intersect, union } from "./setUtils";
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

  getSeenUnits: () => Set<string>;
  getSeenSyslogIdentifiers: () => Set<string>;
}

export interface SearchParams {
  /** If provided, return only entries whose normalized message includes this substring. */
  substring?: string | null;

  /** If provided, return only entries with this priority or higher. */
  minimumPriority?: SyslogPriority | null;

  /** If provided, return only entries from one of these units. */
  units?: string[] | null;

  /** If provided, return only entries having one of these syslog identifiers. */
  syslogIdentifiers?: string[] | null;
}

interface ByteRange {
  beginByteIndex: number;
  endByteIndex: number;
}

export async function buildLogSearcher(
  file: File,
  onProgress?: (progress0To1: number) => void,
): Promise<LogSearcher> {
  const byteRanges: ByteRange[] = [];

  const ngramIndex = new NgramIndex(3);
  const priorityIndex = new FieldValueIndex();
  const unitIndex = new FieldValueIndex();
  const syslogIdentifierIndex = new FieldValueIndex();

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

    const { message, priority, unit, syslogIdentifier } =
      parsedEntry.validatedFields;
    ngramIndex.addDocument(newEntryNumber, normalize(message));
    if (priority !== null) {
      priorityIndex.addEntry(newEntryNumber, priority.toString());
    }
    if (unit !== null) {
      unitIndex.addEntry(newEntryNumber, unit);
    }
    if (syslogIdentifier !== null) {
      syslogIdentifierIndex.addEntry(newEntryNumber, syslogIdentifier);
    }

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

  // TODO: Run all of this in a WebWorker.
  const search = async (
    params: SearchParams,
    abortSignal?: AbortSignal,
  ): Promise<number[]> => {
    const nGramMatches = (() => {
      if (params.substring == null) return null; // No text search query.
      const ngramMatches = ngramIndex.search(normalize(params.substring));
      if (ngramMatches == null) return null; // Query too short to be supported by the n-gram index.
      return new Set(ngramMatches);
    })();

    const priorityMatches =
      params.minimumPriority == null || params.minimumPriority === 7
        ? null
        : union(
            getPriorityValues(params.minimumPriority).map((priority) =>
              priorityIndex.getEntryNumbersForValue(priority.toString()),
            ),
          );

    const unitMatches =
      params.units == null
        ? null
        : union(
            params.units.map((unit) => unitIndex.getEntryNumbersForValue(unit)),
          );

    const syslogIdentifierMatches =
      params.syslogIdentifiers == null
        ? null
        : union(
            params.syslogIdentifiers.map((syslogIdentifier) =>
              syslogIdentifierIndex.getEntryNumbersForValue(syslogIdentifier),
            ),
          );

    const setsToIntersect = [
      nGramMatches,
      priorityMatches,
      unitMatches,
      syslogIdentifierMatches,
    ].filter((m) => m != null);

    const setIntersection = (() => {
      if (setsToIntersect.length > 0) {
        return [...intersect(setsToIntersect)].sort((a, b) => a - b);
      } else {
        const allEntryNumbers = byteRanges.map((_, i) => i);
        return allEntryNumbers;
      }
    })();

    if (params.substring == null) {
      return setIntersection;
    } else {
      const matchingEntryNumbers: number[] = [];
      for (const candidateNumber of setIntersection) {
        abortSignal?.throwIfAborted();
        const candidateContents = await getEntry(candidateNumber);
        if (
          normalize(candidateContents.validatedFields.message).includes(
            normalize(params.substring),
          )
        )
          matchingEntryNumbers.push(candidateNumber);
      }

      abortSignal?.throwIfAborted();

      return matchingEntryNumbers;
    }
  };

  return {
    entryCount: byteRanges.length,
    search,
    getEntries,
    getSeenUnits: () => unitIndex.getSeenValues(),
    getSeenSyslogIdentifiers: () => syslogIdentifierIndex.getSeenValues(),
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

function getPriorityValues(minimumPriority: SyslogPriority): SyslogPriority[] {
  const priorities: SyslogPriority[] = [7, 6, 5, 4, 3, 2, 1, 0] as const;
  const index = priorities.indexOf(minimumPriority);
  return priorities.slice(index);
}

if (import.meta.vitest) {
  const { describe, expect, test } = import.meta.vitest;

  function journalFileFromRecords(records: Record<string, string>[]): File {
    return new File(
      [records.map((r) => JSON.stringify(r)).join("\n")],
      "test.json",
    );
  }

  describe("text search", () => {
    test("empty search", async () => {
      const records: Record<string, string>[] = [
        { MESSAGE: "hello" },
        { MESSAGE: "world" },
      ];
      const searcher = await buildLogSearcher(journalFileFromRecords(records));
      expect(await searcher.search({ substring: null })).toStrictEqual([0, 1]);
      expect(await searcher.search({ substring: "" })).toStrictEqual([0, 1]);
    });
    test("shorter search (not triggering the n-gram code path)", async () => {
      const records: Record<string, string>[] = [
        { MESSAGE: "hello" },
        { MESSAGE: "world" },
        { MESSAGE: "and" },
        { MESSAGE: "goodbye" },
        { MESSAGE: "world" },
      ];
      const searcher = await buildLogSearcher(journalFileFromRecords(records));
      expect(
        await searcher.search({
          substring: "o",
        }),
      ).toStrictEqual([0, 1, 3, 4]);
      expect(
        await searcher.search({
          substring: "O",
        }),
      ).toStrictEqual([0, 1, 3, 4]);
      expect(
        await searcher.search({
          substring: "d",
        }),
      ).toStrictEqual([1, 2, 3, 4]);
      expect(
        await searcher.search({
          substring: "D",
        }),
      ).toStrictEqual([1, 2, 3, 4]);
    });
    test("longer search (triggering the n-gram code path)", async () => {
      const records: Record<string, string>[] = [
        { MESSAGE: "sphinx of black quartz, judge my vow." },
        { MESSAGE: "jackdaws love my big sphinx of quartz." },
      ];
      const searcher = await buildLogSearcher(journalFileFromRecords(records));
      expect(
        await searcher.search({
          substring: "sphinx",
        }),
      ).toStrictEqual([0, 1]);
      expect(
        await searcher.search({
          substring: "SPHINX",
        }),
      ).toStrictEqual([0, 1]);
      expect(
        await searcher.search({
          substring: "love",
        }),
      ).toStrictEqual([1]);
      expect(
        await searcher.search({
          substring: "LOVE",
        }),
      ).toStrictEqual([1]);
    });
  });

  describe("seen values", () => {
    test("getSeenUnits returns distinct units", async () => {
      const records: Record<string, string>[] = [
        { MESSAGE: "a", _SYSTEMD_UNIT: "foo.service" },
        { MESSAGE: "b", _SYSTEMD_UNIT: "bar.service" },
        { MESSAGE: "c", _SYSTEMD_UNIT: "foo.service" },
      ];
      const searcher = await buildLogSearcher(journalFileFromRecords(records));
      expect(searcher.getSeenUnits()).toStrictEqual(
        new Set(["foo.service", "bar.service"]),
      );
    });

    test("getSeenSyslogIdentifiers returns distinct syslog identifiers", async () => {
      const records: Record<string, string>[] = [
        { MESSAGE: "a", SYSLOG_IDENTIFIER: "sshd" },
        { MESSAGE: "b", SYSLOG_IDENTIFIER: "systemd" },
        { MESSAGE: "c", SYSLOG_IDENTIFIER: "sshd" },
      ];
      const searcher = await buildLogSearcher(journalFileFromRecords(records));
      expect(searcher.getSeenSyslogIdentifiers()).toStrictEqual(
        new Set(["sshd", "systemd"]),
      );
    });

    test("empty sets when unit and syslog identifier are absent", async () => {
      const records: Record<string, string>[] = [
        { MESSAGE: "hello" },
        { MESSAGE: "world" },
      ];
      const searcher = await buildLogSearcher(journalFileFromRecords(records));
      expect(searcher.getSeenUnits()).toStrictEqual(new Set());
      expect(searcher.getSeenSyslogIdentifiers()).toStrictEqual(new Set());
    });
  });
}
