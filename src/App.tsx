import React from 'react';
import './App.css';
import { LogIndex, buildIndex, getEntry } from './logAccess'
import { FixedSizeList } from 'react-window'


function Row(
  {index, style, data }: {
    index: number,
    style: object,
    data: {
      file: File,
      logIndex: LogIndex,
    }
  }
): JSX.Element {
  const [text, setText] = React.useState("Loading...")
  const {file, logIndex} = data
  React.useEffect(() => {
    let ignore = false
    getEntry(file, logIndex, index).then((entry: any) => {
      if (!ignore) setText(entry.MESSAGE || "<error>")
    })
    return () => { ignore = true }
    // TODO: Rate-limit this somehow so we don't consume unbounded memory
    // if the user scrolls really fast?
  }, [index, file, logIndex])

  return (
    <div style={style}>{index}: {text}</div>
  )
}


function LogList({file, logIndex}: {file: File, logIndex: LogIndex}): JSX.Element {
  return (
    <FixedSizeList
      height={1000}
      itemCount={logIndex.entryCount}
      itemSize={35}
      width={1000}
      itemData={{file: file, logIndex: logIndex}}
    >
      {Row}
    </FixedSizeList>
  )
}

function Form(): JSX.Element {
  // TODO: Refactor to avoid useEffect chaining?
  // https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations

  const [file, setFile] = React.useState(null as File | null)
  const [index, setIndex] = React.useState(null as LogIndex | null)
  const [entryNumber, setEntryNumber] = React.useState(0)
  const [entry, setEntry] = React.useState(null as object | null)

  React.useEffect(() => {
    let ignore = false
    setIndex(null)
    if (file) {
      buildIndex(file).then((index) => {
        if (!ignore) setIndex(index)
      })
    }
    return () => { ignore = true }
  }, [file])

  React.useEffect(
    () => {
      let ignore = false
      setEntry(null)
      if (file && index) {
        if (0 <= entryNumber && entryNumber < index.entryCount) {
          getEntry(file, index, entryNumber).then((entry) => {
            if (!ignore) setEntry(entry)
          })
        }
      }
      return () => { ignore = true }
    },
    [file, index, entryNumber]
  )

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files ? event.target.files[0] : null
    setFile(file)
  }

  function handleEntryNumberChange(event: React.ChangeEvent<HTMLInputElement>) {
    setEntryNumber(parseInt(event.target.value))
  }

  return (
    <div>
      { file && index ? (<LogList file={file} logIndex={index}></LogList>) : null}
      <label htmlFor="file">Log file (from <code>journalctl --output=json</code>)</label>
      <input id="file" type="file" onChange={handleFileChange}></input>

      <label htmlFor="entryNumber">Log entry number</label>
      <input id="entryNumber" type="number" onChange={handleEntryNumberChange}></input>

      {file && (index == null) ? <p>Indexing...</p> : null}
      <pre>
        {JSON.stringify(entry, null, 2)}
      </pre>
    </div>
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
  return (
    <div>
      <Form></Form>
      <Stopwatch></Stopwatch>
    </div>
  );
}

export default App;
