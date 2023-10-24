import chunks from "./journalParsing/chunks";
import jsonRecordSplitter, {
  ParsedJSON,
} from "./journalParsing/jsonRecordSplitter";
import { NgramIndex } from "./textSearch/ngramIndex";
import { normalize } from "./textSearch/normalize";

export interface LogIndex {
  readonly entryCount: number;
  readonly getEntry: (entryNumber: number) => Promise<LogEntry>;
  readonly getLineCount: (entryNumber: number) => number;
  readonly search: (
    substring: string,
    abortSignal?: AbortSignal,
  ) => Promise<number[]>;
}

export interface LogEntry {
  readonly timestamp: Date;
  readonly priority: number;
  readonly unit: string;
  readonly syslogIdentifier: string;
  readonly message: string; // TODO: Handle binary data.
}

export async function buildIndex(
  file: File,
  onProgress: (number: number) => void,
): Promise<LogIndex> {
  const textSearchIndex = new NgramIndex<number>(3);
  const metadataIndex: {
    lineCount: number;
    startByte: number;
    endByte: number;
  }[] = [];

  console.log(`Reading ${file.size} bytes...`);

  const entryStream = file.stream().pipeThrough(jsonRecordSplitter());

  for await (const entry of chunks(entryStream.getReader())) {
    const newEntryNumber = metadataIndex.length;
    const parsedEntry = parseEntry(entry);

    const lineCount = countNewlines(parsedEntry.message) + 1;

    metadataIndex.push({
      lineCount,
      startByte: entry.beginByteIndex,
      endByte: entry.endByteIndex,
    });
    textSearchIndex.addDocument(newEntryNumber, normalize(parsedEntry.message));

    if (newEntryNumber % 10000 === 0) {
      onProgress(entry.endByteIndex / file.size);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  console.log(
    `Done reading ${metadataIndex.length} entries from ${file.size} bytes.`,
  );

  const getByteRange = (entryNumber: number): [number, number] => [
    metadataIndex[entryNumber].startByte,
    metadataIndex[entryNumber].endByte,
  ];

  const getLineCount = (entryNumber: number): number =>
    metadataIndex[entryNumber].lineCount;

  const getEntry = async (entryNumber: number): Promise<LogEntry> => {
    const [startByte, endByte] = getByteRange(entryNumber);
    const bytes = file.slice(startByte, endByte);
    const reader = bytes.stream().pipeThrough(jsonRecordSplitter()).getReader();
    return parseEntry(await expectOne(chunks(reader)));
  };

  const search = async (
    substring: string,
    abortSignal?: AbortSignal,
  ): Promise<number[]> => {
    // TODO: This can be slow. Run it in a WebWorker.
    const candidates = textSearchIndex.search(normalize(substring));
    const matches: number[] = [];
    for (const candidateNumber of candidates) {
      abortSignal?.throwIfAborted();
      const candidate = await getEntry(candidateNumber);
      if (normalize(candidate.message).includes(normalize(substring)))
        matches.push(candidateNumber);
    }

    abortSignal?.throwIfAborted();
    return matches;
  };

  return {
    entryCount: metadataIndex.length,
    getEntry: getEntry,
    getLineCount,
    search,
  };
}

function parseEntry(parsed: ParsedJSON): LogEntry {
  // TODO: We should probably validate this. The input file is untrusted.
  const json = parsed.parsedJSON;
  // @ts-ignore
  const epochMicroseconds = parseInt(json["__REALTIME_TIMESTAMP"]);
  return {
    timestamp: new Date(epochMicroseconds / 1000),
    // @ts-ignore
    priority: parseInt(json["PRIORITY"]),
    // @ts-ignore
    unit: json["_SYSTEMD_UNIT"], // TODO: Also support _SYSTEMD_USER_UNIT?
    // @ts-ignore
    syslogIdentifier: json["SYSLOG_IDENTIFIER"],
    // @ts-ignore
    message: json["MESSAGE"],
  };
}

function countNewlines(s: string): number {
  return (s.match(/\n/g) || []).length;
}

async function expectOne<T>(asyncIterator: AsyncIterator<T>): Promise<T> {
  const result = await asyncIterator.next();
  if (result.done) throw new Error("Expected exactly one value, but got none.");
  const afterResult = await asyncIterator.next();
  if (!afterResult.done)
    throw new Error(
      `Expected exactly one value, but got extra: ${afterResult.value}`,
    );
  return result.value;
}
