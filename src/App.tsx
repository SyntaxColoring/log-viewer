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
import {
  type LogSearcher,
  type ResultSet,
  buildLogSearcher,
} from "./logAccess";

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
  const searcherState = useSearcherState(file);

  const [wrapLines, setWrapLines] = React.useState(true);

  const [searchQuery, setSearchQuery] = React.useState("");
  const searchResult = useSearch(searcherState, searchQuery);

  const searchBarProps: SearchBarProps = {
    query: searchQuery,
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
          searcherState={searcherState}
          resultSet={
            searchResult.state === "complete" ? searchResult.resultSet : null
          }
          ref={virtuosoRef}
          query={searchQuery}
          wrapLines={wrapLines}
        />
      </Box>
    </Flex>
  );
}

export type SearcherState =
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

export default App;
