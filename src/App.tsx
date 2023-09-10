import React from 'react';
import './App.css';
import { LogEntry, LogIndex, buildIndex, getEntry } from './logAccess'

import { TableVirtuoso } from "react-virtuoso"


function Datetime({ date }: { date: Date }): JSX.Element {
  const isoString = date.toISOString()
  const displayString = date.toLocaleDateString()
  return <time dateTime={isoString}>{displayString}</time>
}

function Row({
  index, file, logIndex
}: {
  index: number,
  file: File,
  logIndex: LogIndex
}): JSX.Element {
  const [rowData, setRowData] = React.useState(null as null | LogEntry)

  React.useEffect(() => {
    let ignore = false
    getEntry(file, logIndex, index).then((entry: LogEntry) => {
      if (!ignore) setRowData(entry)
    })
    return () => { ignore = true }
    // TODO: Rate-limit this somehow so we don't consume unbounded memory
    // if the user scrolls really fast?
  }, [index, file, logIndex])

  if (rowData == null) {
    return <td colSpan={5}>Loading...</td>
  }
  else {
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
    return (<>
      <td className={priorityClass}>{index}</td>
      <td className={priorityClass}><Datetime date={rowData.timestamp} /></td>
      <td className={priorityClass}>{rowData.unit}</td>
      <td className={priorityClass}>{rowData.syslogIdentifier}</td>
      <td className={priorityClass}><pre>{rowData.message}</pre></td>
    </>)
  }
}

function LogView({ file }: { file: File | null }): JSX.Element {
  type State = { status: "indexed", index: LogIndex } | { status: "indexing", progress: number }
  const initialState: State = { status: "indexing", progress: 0 }
  const [state, setState] = React.useState<State>(initialState)

  React.useEffect(() => {
    let ignore = false
    setState(initialState)

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
  else if (state.status != "indexed") {
    return <>
      <p>Loading...</p>
      <meter value={state.progress}></meter>
    </>
  }
  else {
    return (
      <TableVirtuoso
        fixedHeaderContent={() => (
          /* We need to specify an opaque background so the table data isn't visible underneath. */
          <tr style={{ backgroundColor: "white" }}>
            <td style={{ width: "8ch" }}>#</td>
            <td style={{ width: "16ch" }}>Timestamp</td>
            <td style={{ width: "32ch" }}>Unit</td>
            <td style={{ width: "32ch" }}>Syslog ID</td>
            <td>Message</td>
          </tr>
        )}
        style={{ height: '100%', width: "100%" }}
        totalCount={state.index.entryCount}
        itemContent={(entryNumber) => <Row index={entryNumber} file={file} logIndex={state.index} />}
      />
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
      <Stopwatch />
      <FilePicker setFile={setFile} />
      <LogView file={file} />
    </>
  );
}

export default App;
