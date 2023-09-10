export interface LogIndex {
  readonly entryCount: number
  readonly getByteRange: (index: number) => [number, number]
}

export interface LogEntry {
  readonly timestamp: Date
  readonly priority: number
  readonly unit: string
  readonly syslogIdentifier: string
  readonly message: string
}

export async function buildIndex(
  file: File,
  onProgress: (number: number) => void
): Promise<LogIndex> {
  console.log(`Reading ${file.size} bytes...`);

  const newlineIndices: number[] = []
  let bytesReadSoFar = 0
  let chunkCount = 0

  for await (const chunk of chunks(file)) {
    for (const [indexInChunk, byteValue] of chunk.value.entries()) {
      if (byteValue === "\n".charCodeAt(0)) {
        const thisNewlineIndex = bytesReadSoFar + indexInChunk
        newlineIndices.push(thisNewlineIndex)
      }
    }
    bytesReadSoFar += chunk.value.length
    chunkCount++

    // TODO: We do need to yield to the event loop periodically,
    // but there's probably a better way of doing this. WebWorker?
    onProgress(bytesReadSoFar / file.size)
  }

  const hasTrailingNewline = (
    newlineIndices.length > 0
    && newlineIndices[newlineIndices.length - 1] === file.size - 1
  )

  const startIndices = [0].concat(newlineIndices.slice(0, hasTrailingNewline ? -1 : undefined))

  console.log(`Done reading ${startIndices.length} entries from ${file.size} bytes. Used ${chunkCount} chunks.`)

  return {
    entryCount: startIndices.length,
    getByteRange: (index: number): [number, number] => {
      if (0 <= index && index < startIndices.length) {
        const startByte = startIndices[index]
        const endByte = index + 1 < startIndices.length ? startIndices[index + 1] : file.size
        return [startByte, endByte]
      }
      else {
        throw new RangeError(`${index} is not in [0, ${startIndices.length}`)
      }
    }
  }
}

export async function getEntry(file: File, logIndex: LogIndex, entryNumber: number): Promise<LogEntry> {
  const [startByte, endByte] = logIndex.getByteRange(entryNumber)
  const byteLength = endByte - startByte
  if (byteLength > 32 * 1024) console.warn(`Log entry ${entryNumber} is ${byteLength} bytes large.`)
  const slice = file.slice(startByte, endByte)
  const text = await slice.text()
  // TODO: We should probably validate this. The input file is untrusted.
  const parsed = JSON.parse(text)

  const epochMicroseconds = parseInt(parsed["__REALTIME_TIMESTAMP"])
  return {
    timestamp: new Date(epochMicroseconds / 1000),
    priority: parseInt(parsed["PRIORITY"]),
    unit: parsed["_SYSTEMD_UNIT"], // TODO: Also support _SYSTEMD_USER_UNIT?
    syslogIdentifier: parsed["SYSLOG_IDENTIFIER"],
    message: parsed["MESSAGE"]
  }
}

async function* chunks(file: File) {
  // It seems like we shouldn't need this function--we should be able to
  // just do a for-await iteration over file.stream() directly--but I can't get
  // TypeScript to accept that.
  const reader = file.stream().getReader()
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    yield chunk
  }
}
