import { X } from "lucide-react";
import React, { type JSX } from "react";
import { Group, Panel } from "react-resizable-panels";

import { Button } from "@/shadcn/components/ui/button";
import { type LogEntry, type LogSearcher, type ResultSet } from "../logAccess";
import { Datetime } from "./Datetime";
import { FieldList } from "./FieldList";
import FileImportButton from "./FileImportButton";
import { LogView, type LogViewColumn, type LogViewHandle } from "./LogView";
import MarkedText from "./MarkedText";
import { ResizablePanelSeparator } from "./ResizablePanelSeparator";
import { SearchBar, type SearchBarHandle } from "./SearchBar";

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

type SearchResultState =
  | { state: "noSearch" }
  | { state: "inProgress" }
  | { state: "complete"; resultSet: ResultSet };

export type LogViewPageProps = {
  searcher: LogSearcher;
  onReturnHome: () => void;
  onFileSelect: (file: File | null) => void;
};

export function LogViewPage({
  searcher,
  onReturnHome,
  onFileSelect,
}: LogViewPageProps): JSX.Element {
  const searchBarRef = React.useRef<SearchBarHandle>(null);
  const logViewRef = React.useRef<LogViewHandle>(null);
  const shortcutLabel = useSearchLogFocusToggleShortcut(
    searchBarRef,
    logViewRef,
  );

  const [searchQuery, setSearchQuery] = React.useState("");
  const searchResult = useSearch(searcher, searchQuery);
  const [selectedEntryNumber, setSelectedEntryNumber] = React.useState<
    number | null
  >(null);
  const selectedEntry = useSelectedEntry(searcher, selectedEntryNumber);

  const searchBarProps = {
    query: searchQuery,
    placeholder: `Search messages (${shortcutLabel})`,
    status:
      searchResult.state === "noSearch"
        ? { type: "noStatus" as const }
        : searchResult.state === "inProgress"
        ? { type: "progress" as const }
        : searchResult.state === "complete" &&
          searchResult.resultSet.entryCount === 0
        ? { type: "noMatches" as const }
        : {
            type: "matches" as const,
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
        <div className="m-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear file and return to home page"
            title="Clear file and return to home page"
            onClick={onReturnHome}
          >
            <X className="size-4" />
          </Button>
          <FileImportButton onFileSelect={onFileSelect} />
        </div>
        <SearchBar ref={searchBarRef} {...searchBarProps} />
      </div>
      <Panel minSize={MIN_PANEL_SIZE}>
        <LogView
          ref={logViewRef}
          entryNumbers={
            searchResult.state === "complete"
              ? searchResult.resultSet.entryNumbers
              : []
          }
          selectedEntryNumber={selectedEntryNumber}
          onSelectedEntryNumberChange={setSelectedEntryNumber}
          logSearcher={searcher}
          columns={LOG_VIEW_COLUMNS}
          query={searchQuery}
        />
      </Panel>
      <ResizablePanelSeparator orientation="vertical" />
      <Panel minSize={MIN_PANEL_SIZE}>
        {selectedEntryNumber === null ? (
          "Select a log entry to view its details."
        ) : selectedEntry === null ? (
          "Loading selected entry..."
        ) : (
          <>
            <pre className="w-full overflow-x-auto">
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

function useSearch(searcher: LogSearcher, query: string): SearchResultState {
  const [searchResult, setSearchResult] = React.useState<SearchResultState>({
    state: "noSearch",
  });

  React.useEffect(() => {
    const abortController = new AbortController();
    const doSearch = async () => {
      setSearchResult({ state: "inProgress" });
      try {
        const nextResultSet = await searcher.search(
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
    return () => {
      abortController.abort();
    };
  }, [searcher, query]);

  return searchResult;
}

function useSelectedEntry(
  searcher: LogSearcher,
  selectedEntryNumber: number | null,
): LogEntry | null {
  const [selectedEntry, setSelectedEntry] = React.useState<LogEntry | null>(
    null,
  );

  React.useEffect(() => {
    let ignore = false;
    if (selectedEntryNumber === null) {
      setSelectedEntry(null);
      return;
    }

    setSelectedEntry(null);
    const load = async () => {
      const entries = await searcher.getEntries([selectedEntryNumber]);
      if (!ignore) setSelectedEntry(entries[0] ?? null);
    };
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();

    return () => {
      ignore = true;
    };
  }, [searcher, selectedEntryNumber]);

  return selectedEntry;
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
