import React from 'react';

import { TableVirtuoso } from "react-virtuoso"

import { LogEntry, LogIndex, buildIndex, getEntry } from './logAccess'
import { ResourceMonitor } from './ResourceMonitor'


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
      <td className={[priorityClass, "align-right"].join(" ")}>{index+1}</td>
      <td className={priorityClass}><Datetime date={rowData.timestamp} /></td>
      <td className={priorityClass}>{rowData.unit}</td>
      <td className={priorityClass}>{rowData.syslogIdentifier}</td>
      <td className={[priorityClass, "message"].join(" ")}><pre>{rowData.message}</pre></td>
    </>)
  }
}

type IndexState = { status: "indexed", index: LogIndex } | { status: "indexing", progress: number }
const initialLogViewState: IndexState = { status: "indexing", progress: 0 }

function LogView({ file, indexState }: { file: File | null, indexState: IndexState }): JSX.Element {
  if (!file) return <></>
  else if (indexState.status !== "indexed") {
    return <>
      <p>Loading...</p>
      <meter value={indexState.progress}></meter>
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
        totalCount={indexState.index.entryCount}
        itemContent={(entryNumber) => <Row index={entryNumber} file={file} logIndex={indexState.index} />}
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

type SearchBarState = {
  status: "noSearch"
} | {
  status: "searching"
} | {
  status: "searchComplete",
  matchEntryNumbers: number[],
  currentMatchNumber: number,
}

function SearchBar(props: SearchBarState & { onChange: (newSearch: string) => void }): JSX.Element {
  const enableButtons = props.status === "searchComplete"
  return <div>
    <input type="text" onChange={(event) => props.onChange(event.target.value)} />
    {
      props.status === "searchComplete" ?
        <span>{props.currentMatchNumber + 1}/{props.matchEntryNumbers.length}</span>
        : props.status === "searching" ?
          <span>...</span>
          :
          null
    }
    <button disabled={!enableButtons}>⬆️</button>
    <button disabled={!enableButtons}>⬇️</button>
  </div>
}

function App() {
  const [file, setFile] = React.useState(null as File | null)

  const [indexState, setIndexState] = React.useState<IndexState>(initialLogViewState)

  React.useEffect(() => {
    let ignore = false
    setIndexState(initialLogViewState)

    const handleProgress = (progress: number) => {
      if (!ignore) setIndexState({ status: "indexing", progress })
    }

    if (file) {
      buildIndex(file, handleProgress).then((index) => {
        if (!ignore) setIndexState({ status: "indexed", index })
      })
    }
    return () => { ignore = true }
  }, [file])

  const [searchBarState, setSearchBarState] = React.useState<SearchBarState>({ status: "noSearch" })

  const doSearch = React.useMemo(
    () => async (substring: string) => {
      setSearchBarState({status: "searching"}) // TODO: This is race condition prone.
      if (indexState.status === "indexed") {
        const matchEntryNumbers = await indexState.index.search(substring)
        setSearchBarState({
          status: "searchComplete",
          matchEntryNumbers,
          currentMatchNumber: 0 // TODO: Autopopulate this with the closest match?
        })
      }
    },
    [indexState, setSearchBarState]
  )

  const searchBarProps = {
    onChange: doSearch,
    ...searchBarState
  }

  return (
    <>
      <ResourceMonitor />
      <SearchBar {...searchBarProps} />
      <FilePicker setFile={setFile} />
      <LogView file={file} indexState={indexState} />
    </>
  );
}

export default App;
