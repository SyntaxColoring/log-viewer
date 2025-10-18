import { Box, Flex, Switch, Text } from "@radix-ui/themes";
import React from "react";
import { type VirtuosoHandle } from "react-virtuoso";

import { type JSX } from "react";
import { LogView } from "./LogView";
import { ResourceMonitor } from "./ResourceMonitor";
import {
  SearchBar,
  type Props as SearchBarProps,
} from "./components/SearchBar";
import { type LogIndex, buildIndex } from "./logAccess";

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
  const virtuosoRef = React.useRef<VirtuosoHandle>(null);

  const [file, setFile] = React.useState(null as File | null);
  const indexState = useIndex(file);

  const [wrapLines, setWrapLines] = React.useState(true);

  const [searchQuery, setSearchQuery] = React.useState("");
  const searchResult = useSearch(indexState, searchQuery);
  const searchSelection = useSearchSelection(searchResult);

  const selectedRow =
    searchSelection.selection !== null && searchResult.state === "complete"
      ? searchResult.matches[searchSelection.selection]
      : null;

  // Scroll the current selection into view whenever it changes.
  React.useEffect(() => {
    if (selectedRow !== null)
      virtuosoRef.current?.scrollIntoView({
        index: selectedRow,
      });
  }, [selectedRow]);

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
      <FilePicker setFile={setFile} />
      <SearchBar {...searchBarProps} />
      <Flex gap="2">
        <Text as="label">
          <Switch checked={wrapLines} onCheckedChange={setWrapLines} />
          Wrap lines
        </Text>
      </Flex>
      <Box flexGrow="1">
        <LogView
          file={file}
          indexState={indexState}
          ref={virtuosoRef}
          query={searchQuery}
          selectedRow={selectedRow}
          wrapLines={wrapLines}
        />
      </Box>
    </Flex>
  );
}

function wrap(x: number, m: number): number {
  return ((x % m) + m) % m;
}

export type IndexState =
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
      // TODO: Handle errors from this floating promise.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
      // TODO: Handle errors from this floating promise.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
