import React from 'react';
import logo from './logo.svg';
import './App.css';
import { start } from 'repl';

async function buildIndex(file: File): Promise<number[]> {
  console.log(`Reading ${file.size/1024/1024} MiB.`);
  const stream = file.stream()
  const reader = stream.getReader()
  const startIndices: number[] = []
  let readSoFar = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }
    else {
      for (let index = 0; index < chunk.value.length; index++) {
        if (chunk.value[index] == 10) { // 10 is \n
          const overallIndex = readSoFar + index
          startIndices.push(overallIndex)
        }
      }
      readSoFar += chunk.value.length
    }
    // TODO: We do need to yield to the event loop periodically,
    // but there's probably a better way of doing this. WebWorker?
    await new Promise((resolve) => { setTimeout(resolve, 0) })
  }
  console.log("Done.")
  return startIndices
}

function Form(): JSX.Element {
  // TODO: Refactor to avoid useEffect chaining?
  // https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations

  const [file, setFile] = React.useState(null as File | null)
  const [index, setIndex] = React.useState(null as number[] | null)
  const [entryNumber, setEntryNumber] = React.useState(0)
  const [text, setText] = React.useState(null as string | null)

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
      setText(null)
      if (file && index) {
        const startByte = index[Math.min(entryNumber, index.length-1)]
        const endByte = index[Math.min(entryNumber+1, index.length-1)] // TODO: EOF handling isn't quite right here.
        const slice = file.slice(startByte, endByte)
        if (endByte-startByte > 10000) debugger
        slice.text().then((text) => {
          if (!ignore) setText(text)
        })
      }
      return () => { ignore = true }
    },
    [file, index, entryNumber]
  )

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files ? event.target.files[0] : null
    setFile(file)
    if (file) {
      buildIndex(file).then((index) => setIndex(index))
    }
    else {
      setIndex(null)
    }
  }

  function handleEntryNumberChange(event: React.ChangeEvent<HTMLInputElement>) {
    let parsed = parseInt(event.target.value) || 0
    if (parsed < 0) parsed = 0
    setEntryNumber(parsed)
  }

  return (
    <div>
      <label htmlFor="file">Log file (from <code>journalctl --output=json</code>)</label>
      <input id="file" type="file" onChange={handleFileChange}></input>

      <label htmlFor="entryNumber">Log entry number</label>
      <input id="entryNumber" type="number" onChange={handleEntryNumberChange}></input>

      {file && (index == null) ? <p>Indexing...</p> : null}
      <p>{text}</p>
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
