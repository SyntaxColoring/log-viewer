import React from "react";

import { TableVirtuoso, TableVirtuosoHandle } from "react-virtuoso";

import { LogEntry, LogIndex, buildIndex } from "./logAccess";
import { ResourceMonitor } from "./ResourceMonitor";
import { HighlightedText } from "./components/HighlightedText";
import { SearchBar, Props as SearchBarProps } from "./components/SearchBar";

function Datetime({ date }: { date: Date }): JSX.Element {
  const isoString = date.toISOString();
  const displayString = date.toLocaleDateString();
  return <time dateTime={isoString}>{displayString}</time>;
}

function Row({
  index,
  file,
  logIndex,
  query,
}: {
  index: number;
  file: File;
  logIndex: LogIndex;
  query: string;
}): JSX.Element {
  const [rowData, setRowData] = React.useState(null as null | LogEntry);
  React.useEffect(() => {
    let ignore = false;
    logIndex.getEntry(index).then((entry: LogEntry) => {
      if (!ignore) setRowData(entry);
    });
    return () => {
      ignore = true;
    };
    // TODO: Rate-limit this somehow so we don't consume unbounded memory
    // if the user scrolls really fast?
  }, [index, file, logIndex]);

  if (rowData == null) {
    return <td colSpan={5}>Loading...</td>;
  } else {
    const priorityClass = [
      "log-emerg",
      "log-alert",
      "log-crit",
      "log-err",
      "log-warning",
      "log-notice",
      "log-info",
      "log-debug",
    ][rowData.priority];
    return (
      <>
        <td className={[priorityClass, "align-right"].join(" ")}>
          {index + 1}
        </td>
        <td className={priorityClass}>
          <Datetime date={rowData.timestamp} />
        </td>
        <td className={priorityClass}>{rowData.unit}</td>
        <td className={priorityClass}>{rowData.syslogIdentifier}</td>
        <td className={[priorityClass, "message"].join(" ")}>
          <pre>
            <HighlightedText text={rowData.message} query={query} />
          </pre>
        </td>
      </>
    );
  }
}

type IndexState =
  | { status: "indexed"; index: LogIndex }
  | { status: "indexing"; progress: number };
const initialLogViewState: IndexState = { status: "indexing", progress: 0 };

const LogView = React.forwardRef(
  (
    {
      file,
      indexState,
      query,
    }: { file: File | null; indexState: IndexState; query: string },
    ref: React.ForwardedRef<TableVirtuosoHandle>,
  ): JSX.Element => {
    if (!file) return <></>;
    else if (indexState.status !== "indexed") {
      return (
        <>
          <p>Loading...</p>
          <meter value={indexState.progress}></meter>
        </>
      );
    } else {
      return (
        <TableVirtuoso
          ref={ref}
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
          style={{ height: "100%", width: "100%" }}
          totalCount={indexState.index.entryCount}
          itemContent={(entryNumber) => (
            <Row
              index={entryNumber}
              file={file}
              logIndex={indexState.index}
              query={query}
            />
          )}
        />
      );
    }
  },
);

function FilePicker({
  setFile,
}: {
  setFile: (file: File | null) => void;
}): JSX.Element {
  return (
    <form>
      <label htmlFor="file">
        Log file (from <code>journalctl --output=json</code>)
      </label>
      <input
        id="file"
        type="file"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
        }}
      />
    </form>
  );
}

function App() {
  const virtuosoRef = React.useRef<TableVirtuosoHandle>(null);

  const [file, setFile] = React.useState(null as File | null);

  const [indexState, setIndexState] =
    React.useState<IndexState>(initialLogViewState);

  React.useEffect(() => {
    let ignore = false;
    setIndexState(initialLogViewState);

    const handleProgress = (progress: number) => {
      if (!ignore) setIndexState({ status: "indexing", progress });
    };

    if (file) {
      buildIndex(file, handleProgress).then((index) => {
        if (!ignore) setIndexState({ status: "indexed", index });
      });
    }
    return () => {
      ignore = true;
    };
  }, [file]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResult, setSearchResult] = React.useState<
    | { state: "noSearch" }
    | { state: "inProgress"; progress: number }
    | { state: "complete"; matches: number[]; currentMatch: number }
  >({ state: "noSearch" });

  const doSearch = React.useMemo(
    () => async (substring: string) => {
      setSearchQuery(substring);
      // TODO: This is race condition prone. Also, show the actual progress.
      setSearchResult({ state: "inProgress", progress: 0.5 });
      if (indexState.status === "indexed") {
        const matches = await indexState.index.search(substring);
        setSearchResult({
          state: "complete",
          currentMatch: 0, // TODO: Autopopulate this with the closest match?
          matches,
        });
      }
    },
    [indexState],
  );

  const searchBarProps: SearchBarProps = {
    query: searchQuery,
    enableButtons: searchResult.state === "complete",
    status:
      searchResult.state === "noSearch"
        ? null
        : searchResult.state === "inProgress"
        ? { progress: searchResult.progress }
        : {
            currentMatchIndex: searchResult.currentMatch,
            matchCount: searchResult.matches.length,
          },
    onQueryChange: doSearch,
    onUp: () => {
      if (searchResult.state === "complete") {
        const newCurrentMatch = wrap(
          searchResult.currentMatch - 1,
          searchResult.matches.length,
        );
        setSearchResult({
          ...searchResult,
          currentMatch: newCurrentMatch,
        });
        virtuosoRef.current?.scrollToIndex(
          searchResult.matches[newCurrentMatch],
        );
      }
    },
    onDown: () => {
      if (searchResult.state === "complete") {
        const newCurrentMatch = wrap(
          searchResult.currentMatch + 1,
          searchResult.matches.length,
        );
        setSearchResult({
          ...searchResult,
          currentMatch: newCurrentMatch,
        });
        virtuosoRef.current?.scrollToIndex(
          searchResult.matches[newCurrentMatch],
        );
      }
    },
  };

  return (
    <>
      <ResourceMonitor />
      <SearchBar {...searchBarProps} />
      <FilePicker setFile={setFile} />
      <LogView
        file={file}
        indexState={indexState}
        ref={virtuosoRef}
        query={searchQuery}
      />
    </>
  );
}

function wrap(x: number, m: number): number {
  return ((x % m) + m) % m;
}

export default App;
