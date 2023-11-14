import React from "react";

import { TableVirtuoso, TableVirtuosoHandle } from "react-virtuoso";

import { LogEntry, LogIndex, buildIndex } from "./logAccess";
import { ResourceMonitor } from "./ResourceMonitor";
import MarkedText from "./components/MarkedText";
import { SearchBar, Props as SearchBarProps } from "./components/SearchBar";
import { Box, Flex } from "@radix-ui/themes";
import { Datetime } from "./components/Datetime";

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
            <MarkedText text={rowData.message} query={query} />
          </pre>
        </td>
      </>
    );
  }
}

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
  const indexState = useIndex(file);

  const [searchQuery, setSearchQuery] = React.useState("");
  const searchResult = useSearch(indexState, searchQuery);
  const searchSelection = useSearchSelection(searchResult);

  // Scroll the current selection into view whenever it changes.
  React.useEffect(() => {
    if (
      searchSelection.selection !== null &&
      searchResult.state === "complete"
    ) {
      virtuosoRef.current?.scrollIntoView({
        index: searchResult.matches[searchSelection.selection],
      });
    }
  }, [searchResult, searchSelection]);

  const searchBarProps: SearchBarProps = {
    query: searchQuery,
    enableButtons: searchResult.state === "complete",
    status:
      searchResult.state === "noSearch"
        ? { type: "noStatus" }
        : searchResult.state === "inProgress"
        ? { type: "progress", progress: searchResult.progress }
        : searchResult.matches.length === 0
        ? { type: "noMatches" }
        : {
            type: "matches",
            currentMatchIndex: searchSelection.selection || 0, // FIXME
            matchCount: searchResult.matches.length,
          },
    onQueryChange: setSearchQuery,
    onUp: searchSelection.goUp,
    onDown: searchSelection.goDown,
  };

  return (
    <Flex direction="column" style={{ height: "100%" }}>
      <ResourceMonitor />
      <SearchBar {...searchBarProps} />
      <FilePicker setFile={setFile} />
      <Box grow="1">
        <LogView
          file={file}
          indexState={indexState}
          ref={virtuosoRef}
          query={searchQuery}
        />
      </Box>
    </Flex>
  );
}

function wrap(x: number, m: number): number {
  return ((x % m) + m) % m;
}

type IndexState =
  | { status: "indexed"; index: LogIndex }
  | { status: "indexing"; progress: number };

function useIndex(file: File | null): IndexState {
  const [indexState, setIndexState] = React.useState<IndexState>({
    status: "indexing",
    progress: 0,
  });

  React.useEffect(() => {
    let ignore = false;
    setIndexState({ status: "indexing", progress: 0 });

    const handleProgress = (progress: number) => {
      if (!ignore) setIndexState({ status: "indexing", progress });
    };

    if (file) {
      buildIndex(file, debounceProgress(handleProgress)).then((index) => {
        if (!ignore) setIndexState({ status: "indexed", index });
      });
    }
    return () => {
      ignore = true;
    };
  }, [file]);

  return indexState;
}

type SearchResult =
  | { state: "noSearch" }
  | { state: "inProgress"; progress: number }
  | { state: "complete"; matches: number[] };

function useSearch(indexState: IndexState, query: string): SearchResult {
  const [searchResult, setSearchResult] = React.useState<SearchResult>({
    state: "noSearch",
  });

  React.useEffect(() => {
    const abortController = new AbortController();
    if (query === "") {
      setSearchResult({ state: "noSearch" });
    } else if (indexState.status === "indexing") {
      setSearchResult({ state: "inProgress", progress: 0 });
    } else {
      const handleProgress = (progress: number) => {
        setSearchResult({ state: "inProgress", progress });
      };
      const doSearch = async () => {
        setSearchResult({ state: "inProgress", progress: 0 });
        try {
          const matches = await indexState.index.search(
            query,
            debounceProgress(handleProgress),
            abortController.signal,
          );
          setSearchResult({ state: "complete", matches });
        } catch (exception) {
          if (abortController.signal.aborted) {
            // The exception is probably the abort. Ignore it.
          } else {
            throw exception;
          }
        }
      };
      doSearch();
    }
    return () => {
      setSearchResult({ state: "noSearch" });
      abortController.abort();
    };
  }, [indexState, query]);

  return searchResult;
}

function useSearchSelection(searchResult: SearchResult): {
  selection: number | null;
  goUp: () => void;
  goDown: () => void;
} {
  const [selection, setSelection] = React.useState<number | null>(null);

  const increment = (amount: number) => {
    if (searchResult.state === "complete" && selection !== null) {
      const newSelection = wrap(
        selection + amount,
        searchResult.matches.length,
      );
      setSelection(newSelection);
    }
  };
  const goUp = () => {
    increment(-1);
  };
  const goDown = () => {
    increment(1);
  };

  // When the search result changes--i.e., when the user has searched for something new--
  // reset the selection to 0.
  React.useEffect(() => {
    if (searchResult.state === "complete") setSelection(0);
  }, [searchResult]);

  return {
    selection: searchResult.state === "complete" ? selection : null,
    goUp,
    goDown,
  };
}

function debounceProgress(
  onProgress: (progress: number) => void,
): (progress: number) => void {
  let lastCheckpoint = 0;
  return (progress: number) => {
    if (progress - lastCheckpoint > 0.01) {
      onProgress(progress);
      lastCheckpoint = progress;
    }
  };
}

export default App;
