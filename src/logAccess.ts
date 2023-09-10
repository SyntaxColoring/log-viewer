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

export async function buildIndex(file: File): Promise<LogIndex> {
  console.log(`Reading ${file.size} bytes...`);

  const stream = file.stream()
  const reader = stream.getReader()
  const startBytes: number[] = []
  let bytesReadSoFar = 0
  let chunkCount = 0

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }
    else {
      for (let index = 0; index < chunk.value.length; index++) {
        if (chunk.value[index] === 10) { // 10 is \n
          const overallIndex = bytesReadSoFar + index
          startBytes.push(overallIndex)
        }
      }
      bytesReadSoFar += chunk.value.length
      chunkCount++
    }
    // TODO: We do need to yield to the event loop periodically,
    // but there's probably a better way of doing this. WebWorker?
    await new Promise((resolve) => { setTimeout(resolve, 0) })
  }

  console.log(`Done reading ${startBytes.length} entries from ${file.size} bytes. Used ${chunkCount} chunks.`)

  return {
    entryCount: startBytes.length,
    getByteRange: (index: number): [number, number] => {
      if (0 <= index && index < startBytes.length) {
        const startByte = startBytes[index]
        const endByte = index+1 < startBytes.length ? startBytes[index+1] : file.size
        return [startByte, endByte]
      }
      else {
        throw new RangeError(`${index} is not in [0, ${startBytes.length}`)
      }
    }
  }
}


export async function getEntry(file: File, logIndex: LogIndex, entryNumber: number): Promise<LogEntry> {
  const [startByte, endByte] = logIndex.getByteRange(entryNumber)
  const byteLength = endByte - startByte
  if (byteLength > 32*1024) console.warn(`Log entry ${entryNumber} is ${byteLength} bytes large.`)
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
