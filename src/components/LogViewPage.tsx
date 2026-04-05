import { X } from "lucide-react";
import React, { type JSX } from "react";
import { Group, Panel } from "react-resizable-panels";

import {
  type LogEntry,
  type LogSearcher,
  UNDERLYING_RAW_FIELDS,
} from "@/backend";
import { Button } from "@/shadcn/components/ui/button";
import { Datetime } from "./Datetime";
import { FieldList } from "./FieldList";
import FileImportButton from "./FileImportButton";
import {
  DEFAULT_PRIORITY,
  type FilterFieldValues,
  LogFiltersPopover,
} from "./LogFiltersPopover";
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
    render: ({ entry }) => {
      const timestamp = entry.validatedFields.timestamp;
      return timestamp === null ? (
        <span title="" />
      ) : (
        <span title={timestamp.toISOString()}>
          <Datetime date={timestamp} />
        </span>
      );
    },
  },
  {
    field: "unit",
    header: "Unit",
    render: ({ entry }) => (
      <span title={entry.validatedFields.unit ?? ""}>
        {entry.validatedFields.unit ?? ""}
      </span>
    ),
  },
  {
    field: "syslogIdentifier",
    header: "Syslog ID",
    render: ({ entry }) => (
      <span title={entry.validatedFields.syslogIdentifier ?? ""}>
        {entry.validatedFields.syslogIdentifier ?? ""}
      </span>
    ),
  },
  {
    field: "message",
    header: "Message",
    render: ({ entry, query }) => (
      <span title={entry.validatedFields.message ?? ""}>
        <MarkedText
          text={entry.validatedFields.message ?? ""}
          query={query ?? ""}
        />
      </span>
    ),
  },
];

type SearchResultState =
  | { state: "noSearch" }
  | { state: "inProgress" }
  | { state: "complete"; resultEntryNumbers: number[] };

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
  const [filters, setFilters] = React.useState<FilterFieldValues>({
    leastSeverePriority: DEFAULT_PRIORITY,
    units: [],
    syslogIdentifiers: [],
  });

  const unitFilterOptions = [...searcher.getSeenUnits()].sort((a, b) =>
    a.localeCompare(b),
  );
  const syslogIdentifierFilterOptions = [
    ...searcher.getSeenSyslogIdentifiers(),
  ].sort((a, b) => a.localeCompare(b));

  const searchResult = useSearch(searcher, searchQuery, filters);

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
          searchResult.resultEntryNumbers.length === 0
        ? { type: "noMatches" as const }
        : {
            type: "matches" as const,
            matchCount:
              searchResult.state === "complete"
                ? searchResult.resultEntryNumbers.length
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
            aria-label="Clear current file"
            title="Clear current file"
            onClick={() => {
              if (confirm("Clear the current file?")) {
                onReturnHome();
              }
            }}
          >
            <X className="size-4" />
          </Button>
          <FileImportButton onFileSelect={onFileSelect} />
        </div>
        <div className="m-2 flex flex-wrap items-center gap-2">
          <div className="min-w-64 flex-1">
            <SearchBar ref={searchBarRef} {...searchBarProps} />
          </div>
          <LogFiltersPopover
            filters={filters}
            onFiltersChange={setFilters}
            unitOptions={unitFilterOptions}
            syslogIdentifierOptions={syslogIdentifierFilterOptions}
          />
        </div>
      </div>
      <Panel minSize={MIN_PANEL_SIZE}>
        <LogView
          ref={logViewRef}
          entryNumbers={
            searchResult.state === "complete"
              ? searchResult.resultEntryNumbers
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
              <MarkedText
                text={selectedEntry.validatedFields.message ?? ""}
                query={searchQuery}
              />
            </pre>
            <FieldList
              data={formatSelectedEntryForFieldList(selectedEntry, [
                UNDERLYING_RAW_FIELDS.message,
              ])}
            />
          </>
        )}
      </Panel>
    </Group>
  );
}

function useSearch(
  searcher: LogSearcher,
  query: string,
  filters: FilterFieldValues,
): SearchResultState {
  const [searchResult, setSearchResult] = React.useState<SearchResultState>({
    state: "noSearch",
  });

  React.useEffect(() => {
    const abortController = new AbortController();
    const doSearch = async () => {
      setSearchResult({ state: "inProgress" });
      try {
        const nextResultSet = await searcher.search(
          {
            substring: query === "" ? null : query,
            minimumPriority: filters.leastSeverePriority,
            units: filters.units.length === 0 ? null : filters.units,
            syslogIdentifiers:
              filters.syslogIdentifiers.length === 0
                ? null
                : filters.syslogIdentifiers,
          },
          abortController.signal,
        );
        setSearchResult({
          state: "complete",
          resultEntryNumbers: nextResultSet,
        });
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
  }, [searcher, query, filters]);

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

    // I know of no better way to do this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedEntry(null);

    const load = async () => {
      let entry: LogEntry | null = null;
      if (selectedEntryNumber === null) entry = null;
      else [entry] = await searcher.getEntries([selectedEntryNumber]);
      if (!ignore) setSelectedEntry(entry);
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
): Map<string, string> {
  return new Map(
    Array.from(entry.rawFields.entries()).filter(
      ([key]) => !keysToExclude.includes(key),
    ),
  );
}
