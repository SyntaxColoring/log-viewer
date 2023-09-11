import React from 'react';
import './App.css';
import { LogEntry, LogIndex, buildIndex, getEntry } from './logAccess'

import { TableVirtuoso } from "react-virtuoso"

import { renderToStaticMarkup } from "react-dom/server"


function Datetime({ date }: { date: Date }): JSX.Element {
  const isoString = date.toISOString()
  const displayString = date.toLocaleDateString()
  return <time dateTime={isoString}>{displayString}</time>
}

function Row({
  entryNumber,
  rowData
}: {
  entryNumber: number
  rowData: LogEntry
}): JSX.Element {
  const priorityClass = [
    "log-emerg",
    "log-alert",
    "log-crit",
    "log-err",
    "log-warning",
    "log-notice",
    "log-info",
    "log-debug",
  ][rowData.priority]
  return (<tr>
    <td className={priorityClass}>{entryNumber}</td>
    <td className={priorityClass}><Datetime date={rowData.timestamp} /></td>
    <td className={priorityClass}>{rowData.unit}</td>
    <td className={priorityClass}>{rowData.syslogIdentifier}</td>
    <td className={priorityClass}><pre>{rowData.message}</pre></td>
  </tr>)
}

async function* entries(file: File, index: LogIndex): AsyncGenerator<[number, LogEntry], void>{
  for (let entryNumber = 0; entryNumber < index.entryCount; entryNumber++) {
    const entry = await getEntry(file, index, entryNumber)
    yield [entryNumber, entry]
  }
}

async function generateAllRows(file: File, index: LogIndex, container: HTMLElement, abortController: AbortController): Promise<void> {
  for await (const [entryNumber, entry] of entries(file, index)) {
    if (abortController.signal.aborted) return
    const htmlMarkup = renderToStaticMarkup(<Row entryNumber={entryNumber} rowData={entry} />)
    container.insertAdjacentHTML("beforeend", htmlMarkup)
    if (entryNumber % 100 == 0) console.log(entryNumber)
  }
  console.log("Done. Showing table...")
  container.setAttribute("style", "")
}

function AllRows({file, index}: {file: File, index: LogIndex}): JSX.Element {
  console.log("AllRows")
  const containerRef = React.useRef(null)
  React.useEffect(() => {
    console.log("useEffect")
    const abortController = new AbortController()
    if (containerRef.current != null) {
      generateAllRows(file, index, containerRef.current, abortController)
    }
    return () => { abortController.abort() }
  }, [containerRef])

  return <tbody ref={containerRef} style={{display: "none"}} />
}

type LogViewState = { status: "indexed", index: LogIndex } | { status: "indexing", progress: number }
const initialLogViewState: LogViewState = { status: "indexing", progress: 0 }

function LogView({ file }: { file: File | null }): JSX.Element {
  console.log("LogView")
  const [state, setState] = React.useState<LogViewState>(initialLogViewState)

  React.useEffect(() => {
    let ignore = false
    setState(initialLogViewState)

    const handleProgress = (progress: number) => {
      if (!ignore) setState({status: "indexing", progress})
    }

    if (file) {
      buildIndex(file, handleProgress).then((index) => {
        if (!ignore) setState({status: "indexed", index})
      })
    }
    return () => { ignore = true }
  }, [file])

  if (!file) return <></>
  else if (state.status !== "indexed") {
    return <>
      <p>Loading...</p>
      <meter value={state.progress}></meter>
    </>
  }
  else {
    return (
      <table style={{ height: '100%', width: '100%' }}>
        <thead>
          <tr style={{ backgroundColor: "white" }}>
            <td style={{ width: "8ch" }}>#</td>
            <td style={{ width: "16ch" }}>Timestamp</td>
            <td style={{ width: "32ch" }}>Unit</td>
            <td style={{ width: "32ch" }}>Syslog ID</td>
            <td>Message</td>
          </tr>
        </thead>
        <AllRows file={file} index={state.index}/>
      </table>
    )
  }
}

function FilePicker({ setFile }: { setFile: (file: File | null) => void }): JSX.Element {
  return (
    <form>
      <label htmlFor="file">Log file (from <code>journalctl --output=json</code>)</label>
      <input
        id="file"
        type="file"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null)
        }}
      />
    </form>
  )
}

function Stopwatch() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [startTime, _] = React.useState(Date.now())
  const [currentTime, setCurrentTime] = React.useState(startTime)

  React.useEffect(() => {
    let keepGoing = true;
    const step = () => {
      setCurrentTime(Date.now())
      if (keepGoing) window.requestAnimationFrame(step)
    }
    window.requestAnimationFrame(step)
    return () => { keepGoing = false }
  }, [])

  return (
    <p>A timer to show when this page stalls up: {currentTime}</p>
  );
}

function App() {
  const [file, setFile] = React.useState(null as File | null)

  return (
    <>
      {/* <Stopwatch /> */}
      <FilePicker setFile={setFile} />
      <LogView file={file} />
    </>
  );
}

export default App;
