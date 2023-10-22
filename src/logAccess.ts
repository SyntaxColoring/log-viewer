import { NgramIndex } from "./textSearch/ngramIndex";
import { normalize } from "./textSearch/normalize";

export interface LogIndex {
  readonly entryCount: number;
  readonly getByteRange: (entryNumber: number) => [number, number];
  readonly getLineCount: (entryNumber: number) => number;
  readonly search: (substring: string) => Promise<number[]>;
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
  console.log(`Reading ${file.size} bytes...`);

  const textSearchIndex = new NgramIndex<number>(3);

  const newlineIndices: number[] = [];
  const lineCounts: number[] = [];
  let bytesReadSoFar = 0;
  let chunkCount = 0;

  for await (const chunk of chunks(file)) {
    for (const [indexInChunk, byteValue] of chunk.value.entries()) {
      if (byteValue === "\n".charCodeAt(0)) {
        const thisNewlineIndex = bytesReadSoFar + indexInChunk;
        newlineIndices.push(thisNewlineIndex);
      }
    }
    bytesReadSoFar += chunk.value.length;
    chunkCount++;

    // TODO: We do need to yield to the event loop periodically,
    // but there's probably a better way of doing this. WebWorker?
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    onProgress(bytesReadSoFar / file.size);
  }

  const hasTrailingNewline =
    newlineIndices.length > 0 &&
    newlineIndices[newlineIndices.length - 1] === file.size - 1;

  const startIndices = [0].concat(
    newlineIndices.slice(0, hasTrailingNewline ? -1 : undefined),
  );

  console.log(
    `Done reading ${startIndices.length} entries from ${file.size} bytes. Used ${chunkCount} chunks.`,
  );

  const getByteRange = (entryNumber: number): [number, number] => {
    if (0 <= entryNumber && entryNumber < startIndices.length) {
      const startByte = startIndices[entryNumber];
      const endByte =
        entryNumber + 1 < startIndices.length
          ? startIndices[entryNumber + 1]
          : file.size;
      return [startByte, endByte];
    } else {
      throw new RangeError(
        `${entryNumber} is not in [0, ${startIndices.length}`,
      );
    }
  };

  // TODO: Move this to when we're first parsing the entries, for better cache coherence.
  for (let entryNumber = 0; entryNumber < startIndices.length; entryNumber++) {
    const [startByte, endByte] = getByteRange(entryNumber);
    const entry = parseEntry(await file.slice(startByte, endByte).text());

    const lineCount = countNewlines(entry.message) + 1;
    lineCounts.push(lineCount);

    textSearchIndex.addDocument(entryNumber, normalize(entry.message));
  }

  const getLineCount = (entryNumber: number): number => {
    if (0 <= entryNumber && entryNumber < startIndices.length) {
      return lineCounts[entryNumber];
    } else {
      throw new RangeError(
        `${entryNumber} is not in [0, ${startIndices.length}`,
      );
    }
  };

  const search = async (substring: string): Promise<number[]> => {
    const candidates = textSearchIndex.search(normalize(substring));
    const matches: number[] = [];
    for (const candidateNumber of candidates) {
      const [startByte, endByte] = getByteRange(candidateNumber);
      const candidate = parseEntry(await file.slice(startByte, endByte).text());
      if (normalize(candidate.message).includes(normalize(substring)))
        matches.push(candidateNumber);
    }
    return matches;
  };

  return {
    entryCount: startIndices.length,
    getByteRange,
    getLineCount,
    search,
  };
}

export async function getEntry(
  file: File,
  logIndex: LogIndex,
  entryNumber: number,
): Promise<LogEntry> {
  const [startByte, endByte] = logIndex.getByteRange(entryNumber);
  const byteLength = endByte - startByte;
  if (byteLength > 32 * 1024)
    console.warn(`Log entry ${entryNumber} is ${byteLength} bytes large.`);
  const slice = file.slice(startByte, endByte);
  const text = await slice.text();
  return parseEntry(text);
}

async function* chunks(file: File) {
  // It seems like we shouldn't need this function--we should be able to
  // just do a for-await iteration over file.stream() directly--but I can't get
  // TypeScript to accept that.
  const reader = file.stream().getReader();
  for (
    let chunk = await reader.read();
    !chunk.done;
    chunk = await reader.read()
  ) {
    yield chunk;
  }
}

function parseEntry(rawString: string): LogEntry {
  // TODO: We should probably validate this. The input file is untrusted.
  const parsed = JSON.parse(rawString);

  const epochMicroseconds = parseInt(parsed["__REALTIME_TIMESTAMP"]);
  return {
    timestamp: new Date(epochMicroseconds / 1000),
    priority: parseInt(parsed["PRIORITY"]),
    unit: parsed["_SYSTEMD_UNIT"], // TODO: Also support _SYSTEMD_USER_UNIT?
    syslogIdentifier: parsed["SYSLOG_IDENTIFIER"],
    message: parsed["MESSAGE"],
  };
}

function countNewlines(s: string): number {
  return (s.match(/\n/g) || []).length;
}
