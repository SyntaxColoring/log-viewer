import React, { type JSX } from "react";

import { Group, Panel } from "react-resizable-panels";
import styles from "./App.module.css";
import { Datetime } from "./components/Datetime";
import { FieldList } from "./components/FieldList";
import MarkedText from "./components/MarkedText";
import { ResizablePanelSeparator } from "./components/ResizablePanelSeparator";
import {
  SearchBar,
  type SearchBarHandle,
  type SearchBarProps,
} from "./components/SearchBar";
import {
  type LogEntry,
  type LogSearcher,
  type ResultSet,
  buildLogSearcher,
} from "./logAccess";
import { LogView, type LogViewColumn, type LogViewHandle } from "./LogView";
import { ResourceMonitor } from "./ResourceMonitor";

const MIN_PANEL_SIZE = 50;
const LOG_VIEW_COLUMNS: LogViewColumn[] = [
  {
    field: "entryNumber",
    header: "#",
    render: ({ entry }) => (
      <span title={String(entry.entryNumber + 1)}>{entry.entryNumber + 1}</span>
    ),
  },
  {
    field: "timestamp",
    header: "Timestamp",
    render: ({ entry }) => (
      <span title={entry.timestamp.toISOString()}>
        <Datetime date={entry.timestamp} />
      </span>
    ),
  },
  {
    field: "unit",
    header: "Unit",
    render: ({ entry }) => (
      <span title={entry.unit ?? ""}>{entry.unit ?? ""}</span>
    ),
  },
  {
    field: "syslogIdentifier",
    header: "Syslog ID",
    render: ({ entry }) => (
      <span title={entry.syslogIdentifier ?? ""}>
        {entry.syslogIdentifier ?? ""}
      </span>
    ),
  },
  {
    field: "message",
    header: "Message",
    render: ({ entry, query }) => (
      <span title={entry.message}>
        <MarkedText text={entry.message} query={query ?? ""} />
      </span>
    ),
  },
];

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

export default function App() {
  const [file, setFile] = React.useState(null as File | null);
  const searcherState = useSearcherState(file);
  const searchBarRef = React.useRef<SearchBarHandle>(null);
  const logViewRef = React.useRef<LogViewHandle>(null);
  const shortcutLabel = useSearchLogFocusToggleShortcut(
    searchBarRef,
    logViewRef,
  );

  const [searchQuery, setSearchQuery] = React.useState("");
  const searchResult = useSearch(searcherState, searchQuery);
  const [selectedEntryNumber, setSelectedEntryNumber] = React.useState<
    number | null
  >(null);
  const selectedEntry = useSelectedEntry(searcherState, selectedEntryNumber);

  const searchBarProps: SearchBarProps = {
    query: searchQuery,
    placeholder: `Search messages (${shortcutLabel})`,
    status:
      searchResult.state === "noSearch"
        ? { type: "noStatus" }
        : searchResult.state === "inProgress"
        ? { type: "progress" }
        : searchResult.state === "complete" &&
          searchResult.resultSet.entryCount === 0
        ? { type: "noMatches" }
        : {
            type: "matches",
            matchCount:
              searchResult.state === "complete"
                ? searchResult.resultSet.entryCount
                : 0,
          },
    onQueryChange: setSearchQuery,
  };

  return (
    <Group orientation="vertical">
      <div>
        <ResourceMonitor />
        <FilePicker
          setFile={(nextFile) => {
            setSelectedEntryNumber(null);
            setFile(nextFile);
          }}
        />
        {searcherState.status === "indexing" && (
          <FileUploadProgress progress={searcherState.progress} />
        )}
        <SearchBar ref={searchBarRef} {...searchBarProps} />
      </div>
      <Panel minSize={MIN_PANEL_SIZE}>
        {searcherState.status === "indexed" && (
          <LogView
            ref={logViewRef}
            entryNumbers={
              searchResult.state === "complete"
                ? searchResult.resultSet.entryNumbers
                : []
            }
            selectedEntryNumber={selectedEntryNumber}
            onSelectedEntryNumberChange={setSelectedEntryNumber}
            logSearcher={searcherState.searcher}
            columns={LOG_VIEW_COLUMNS}
            query={searchQuery}
          />
        )}
      </Panel>
      <ResizablePanelSeparator orientation="vertical" />
      <Panel minSize={MIN_PANEL_SIZE}>
        {selectedEntryNumber === null ? (
          "Select a log entry to view its details."
        ) : selectedEntry === null ? (
          "Loading selected entry..."
        ) : (
          <>
            <pre className={styles.selectedMessage}>
              <MarkedText text={selectedEntry.message} query={searchQuery} />
            </pre>
            <FieldList
              data={formatSelectedEntryForFieldList(selectedEntry, ["message"])}
            />
          </>
        )}
      </Panel>
    </Group>
  );
}

function FileUploadProgress({ progress }: { progress: number }): JSX.Element {
  const percent = Math.round(progress * 100);
  return (
    <label>
      Importing: {percent}%
      <progress
        max={100}
        value={percent}
        className={styles.importProgressBar}
      />
    </label>
  );
}

type SearcherState =
  | { status: "noFile" }
  | { status: "indexed"; searcher: LogSearcher }
  | { status: "indexing"; progress: number };

function useSearcherState(file: File | null): SearcherState {
  const [searcherState, setSearcherState] = React.useState<SearcherState>({
    status: "noFile",
  });

  React.useEffect(() => {
    let ignore = false;
    if (!file) {
      setSearcherState({ status: "noFile" });
    } else {
      setSearcherState({ status: "indexing", progress: 0 });

      const handleProgress = (progress: number) => {
        if (!ignore) setSearcherState({ status: "indexing", progress });
      };

      // TODO: Handle errors from this floating promise.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      buildLogSearcher(file, debounceProgress(handleProgress)).then(
        (searcher) => {
          if (!ignore) setSearcherState({ status: "indexed", searcher });
        },
      );
    }
    return () => {
      ignore = true;
    };
  }, [file]);

  return searcherState;
}

type SearchResult =
  | { state: "noSearch" }
  | { state: "inProgress" }
  | { state: "complete"; resultSet: ResultSet };

function useSearch(searcherState: SearcherState, query: string): SearchResult {
  const [searchResult, setSearchResult] = React.useState<SearchResult>({
    state: "noSearch",
  });

  React.useEffect(() => {
    const abortController = new AbortController();
    if (searcherState.status !== "indexed") {
      setSearchResult({ state: "noSearch" });
    } else {
      const doSearch = async () => {
        setSearchResult({ state: "inProgress" });
        try {
          const nextResultSet = await searcherState.searcher.search(
            { substring: query === "" ? null : query },
            abortController.signal,
          );
          setSearchResult({ state: "complete", resultSet: nextResultSet });
        } catch (exception) {
          if (abortController.signal.aborted) {
            // The exception is probably the abort. Ignore it.
          } else {
            throw exception;
          }
        }
      };
      // TODO: Handle errors from this floating promise.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      doSearch();
    }
    return () => {
      abortController.abort();
    };
  }, [searcherState, query]);

  return searchResult;
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

function useSelectedEntry(
  searcherState: SearcherState,
  selectedEntryNumber: number | null,
): LogEntry | null {
  const [selectedEntry, setSelectedEntry] = React.useState<LogEntry | null>(
    null,
  );

  React.useEffect(() => {
    let ignore = false;
    if (searcherState.status !== "indexed" || selectedEntryNumber === null) {
      setSelectedEntry(null);
      return;
    }

    setSelectedEntry(null);
    const load = async () => {
      const entries = await searcherState.searcher.getEntries([
        selectedEntryNumber,
      ]);
      if (!ignore) setSelectedEntry(entries[0] ?? null);
    };
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();

    return () => {
      ignore = true;
    };
  }, [searcherState, selectedEntryNumber]);

  return selectedEntry;
}

function formatSelectedEntryForFieldList(
  entry: LogEntry,
  keysToExclude: string[] = [],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(entry)
      .filter(([key]) => !keysToExclude.includes(key))
      .map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : String(value),
      ]),
  );
}

function useSearchLogFocusToggleShortcut(
  searchBarRef: React.RefObject<SearchBarHandle | null>,
  logViewRef: React.RefObject<LogViewHandle | null>,
): string {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isToggleShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k" &&
        !event.altKey &&
        !event.shiftKey &&
        !event.isComposing;
      if (!isToggleShortcut) return;

      const searchBar = searchBarRef.current;
      if (!searchBar) return;

      if (searchBar.isFocused()) {
        if (!logViewRef.current) return;
        event.preventDefault();
        logViewRef.current.focus();
        return;
      }

      event.preventDefault();
      searchBar.focus();
      searchBar.select();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [logViewRef, searchBarRef]);

  return typeof navigator !== "undefined" &&
    /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform)
    ? "⌘K"
    : "Ctrl+K";
}
